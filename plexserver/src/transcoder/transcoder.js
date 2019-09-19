
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const _ = require('lodash');
const fs = require('fs');
const os = require('os');
const util = require('util');
const cliprogress = require('cli-progress');
const mkdirpsync = require('mkdirpsync');
const uuidv4 = require('uuid/v4');
const rimraf = require('rimraf');


// a helper function to extract a subtitle stream
const extractSubtitleStream = async (sourcefn, streamno, outputSubsFile) => {
  const proc = ffmpeg({
      source: sourcefn,
      cwd: ".",
  });
  proc.output(outputSubsFile);
  proc.outputOptions([
    "-map 0:" + streamno,
  ])
  return await waitForFFmpeg(proc);
}

const waitForFFmpeg = (proc) => {
  return new Promise((accept, reject) => {
    const bar = new cliprogress.SingleBar({}, cliprogress.Presets.shades_classic);
    proc.on('start', function(commandLine) {
      console.log('Spawned ffmpeg with command: ' + commandLine);
      bar.start(100, 0);
    });
    proc.on('progress', (info) => {
        // console.log('progress', info);
        bar.update(Math.round(info.percent * 100) / 100);
      })
      .on('end', () => {
        bar.stop();
        accept();
      })
      // .on("stderr", console.log)
      .on('error', (err) => {
        bar.stop();
        reject(err);
      });
    proc.run();
  });
}

// NOTE: can only be one 'preprocess' process at a time :P
rimraf.sync(path.join(os.tmpdir(), "/plex_preprocess/"));

module.exports = async (args) => {
  args = Object.assign({}, args);
  args.filename = path.resolve(args.filename);
  args.outputdir = path.resolve(args.outputdir);

  const tmpDir = path.join(os.tmpdir(), "/plex_preprocess/" + uuidv4());
  console.log("working directory: " + tmpDir);
  mkdirpsync(tmpDir);

  try {
    /*
      analyze the video file
    */
    const mediaInfo = await util.promisify(ffmpeg.ffprobe)(args.filename);
    console.log(JSON.stringify(mediaInfo, false, 2));

    const metadata = {
      fallback: "fallback.mp4",
      dashStream: "stream.mpd",
      subtitles: {},
    };

    // scan for subtitles
    // TODO: find a good way to associate ondisk subtitles
    console.log("scanning for subtitles to extract");
    let imageSubtitlesIdx = -1;
    for (const stream of mediaInfo.streams) {
      if (stream.codec_type === "subtitle" || stream.codec_name.indexOf("text") !== -1) {
        if (stream.codec_name.indexOf("text") !== -1 || stream.codec_name === "ass" || stream.codec_name === "ssa") {
          console.log("\tfound subtitles, language: " + stream.tags.language + " on stream #" + stream.index);
          let language;
          if (stream.tags.language === "und")
            language = "";
          else 
            language = "." + stream.tags.language;
          
          const subtitleFile = "subtitles" + language + ".vtt";
          await extractSubtitleStream(args.filename, stream.index, path.join(tmpDir, subtitleFile));
          metadata.subtitles[stream.tags.language] = {
            file: subtitleFile,
          };
        } else {
          console.log("\tfound video subtitles, index: " + stream.index);
          imageSubtitlesIdx = stream.index;
          break;
        }
      }
    }

    // select the audio stream to keep 
    let audioStreamIdx = -1;
    let videoStreamIdx = -1;
    for (const stream of mediaInfo.streams) {
      if (stream.codec_type === "video") {
        videoStreamIdx = stream.index;
      } else if (stream.codec_type === "audio") {
        if (stream.tags.language.toLowerCase() === "und" && audioStreamIdx === -1) {
          audioStreamIdx = stream.index;
        } else if (stream.tags.language.toLowerCase() === "eng") {
          audioStreamIdx = stream.index;
        }
      }
    }

    const videoStream = mediaInfo.streams[videoStreamIdx];

    // NOTE: todo burn in the subtitles 
    if (imageSubtitlesIdx !== -1) {
      throw new Error(args.filename + " uses image subtitle stream at index: " + imageSubtitlesIdx);
      // going to wind up being something like this: // ffmpeg -i input.mkv -filter_complex "[0:v][0:s]overlay[v]" -map "[v]" -map 0:a <output options> output.mkv
    }
    
    console.log("using video at stream #" + videoStreamIdx + " and audio at stream #" + audioStreamIdx);

    /*
      generate the fallback.mp4 at 720p maximum resolution
    */
    const proc = ffmpeg({
      source: args.filename,
      cwd: tmpDir,
    });
    
    console.log("setting up fallback.mp4 generation");

    proc
      .output(path.join(tmpDir, `fallback.mp4`))
      .format('mp4')
      .videoCodec('libx264')
      .addOptions(['-crf 20', '-maxrate 2M', '-bufsize 2M'])
      .size(`?x${ Math.min(720, videoStream.height) }`)
      .audioCodec('aac')
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
        '-preset fast',
        '-movflags +faststart',
        '-keyint_min 60',
        '-refs 5',
        '-g 60',
        '-pix_fmt yuv420p',
        '-sc_threshold 0',
        '-profile:v main',
        "-map_metadata", "-1",
        "-profile:v baseline",
        '-map 0:v:0',
        '-map 0:a:' + _.filter(mediaInfo.streams, (stream) => {
          return stream.index < audioStreamIdx && stream.codec_type === "audio"
        }).length,
        '-b:a 196k',
      ]);
    
    /*
      generate the dash video streams
    */
    console.log("generating dash manifest and video sequences");
    const calcBitrateForSize = (size) => {
      const baseMaxBitrate = 4000;
      const baseMaxBitrateFrameSize = 1080;
      if (size > baseMaxBitrateFrameSize) {
        return Math.round(size / baseMaxBitrateFrameSize * baseMaxBitrate);
      } else {
        const tmp = size / baseMaxBitrateFrameSize;
        return Math.round(baseMaxBitrate * tmp * tmp);
      }
    }

    // calculate an array of video sizes
    const sizes = [
      {
        height: videoStream.height / 2, 
        bitrate: calcBitrateForSize(videoStream.height / 2)
      },
      {
        height: videoStream.height, 
        bitrate: calcBitrateForSize(videoStream.height)
      },
    ];

    if (videoStream.height > 1080) {
      sizes.push({
        height: 1080, 
        bitrate: calcBitrateForSize(1080)
      });
    }
    sizes.sort((a, b) => {
      return a.height - b.height;
    });
    metadata.sizes = sizes;

    console.log("producing video at sizes:", JSON.stringify(sizes, false, 3));

    proc
      .output(path.join(tmpDir, "stream.mpd"))
      .format('dash')
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
        '-preset fast',
        '-keyint_min 60',
        '-g 60',
        '-sc_threshold 0',
        '-profile:v high',
        '-use_template 1',
        '-use_timeline 1',
        '-b_strategy 0',
        '-bf 1',
        '-map 0:a:' + _.filter(mediaInfo.streams, (stream) => {
          return stream.index < audioStreamIdx && stream.codec_type === "audio"
        }).length,
        '-b:a 196k',
      ]);

    for (const size of sizes) {
      let index = sizes.indexOf(size);

      proc
        .outputOptions([
          `-filter_complex [0]format=pix_fmts=yuv420p[temp${index}];[temp${index}]scale=-2:${size.height}[A${index}]`,
          `-map [A${index}]:v`,
          `-b:v:${index} ${size.bitrate}k`,
        ]);
    }

    await waitForFFmpeg(proc);

    try {
      rimraf(args.outputdir);
    } catch (e) { };

    fs.renameSync(tmpDir, args.outputdir);

    return metadata;
  } catch (e) {
    rimraf.sync(tmpDir);
    throw e;
  }
}