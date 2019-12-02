const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const _ = require("lodash");
const fs = require("fs");
const os = require("os");
const util = require("util");
const cliprogress = require("cli-progress");
const mkdirpsync = require("mkdirpsync");
const uuidv4 = require("uuid/v4");
const rimraf = require("rimraf");
const fsutil = require("../util/fsutil");
const prettyBytes = require("pretty-bytes");

// a helper function to extract a subtitle stream
const extractSubtitleStream = async (sourcefn, streamno, outputSubsFile) => {
  const proc = ffmpeg({
    source: sourcefn,
    cwd: "."
  });
  proc.output(outputSubsFile);
  proc.outputOptions(["-map 0:" + streamno]);
  return await waitForFFmpeg(proc);
};

const waitForFFmpeg = proc => {
  return new Promise((accept, reject) => {
    const bar = new cliprogress.SingleBar(
      {
        etaBuffer: 100
      },
      cliprogress.Presets.legacy
    );
    proc.on("start", function(commandLine) {
      console.log("Spawned ffmpeg with command: " + commandLine);
      bar.start(100, 0);
    });
    proc
      .on("progress", info => {
        // console.log('progress', info);
        bar.update(Math.round(info.percent * 100) / 100);
      })
      .on("end", () => {
        bar.stop();
        accept();
      })
      .on("stderr", console.log)
      // .on("stdout", console.log)
      .on("error", err => {
        bar.stop();
        reject(err);
      });
    proc.run();
  });
};

// NOTE: can only be one 'preprocess' process at a time :P
// rimraf.sync(path.join(os.tmpdir(), "/plex_preprocess/"));

module.exports = async args => {
  args = Object.assign({}, args);
  args.filename = path.resolve(args.filename);
  args.outputdir = path.resolve(args.outputdir);

  const tmpDir = path.join(os.tmpdir(), "/plex_preprocess/" + uuidv4());
  console.log("working directory: " + tmpDir);
  mkdirpsync(tmpDir);

  process.on("SIGINT", function() {
    console.log("cleaning up after ourselves.");
    try {
      rimraf.sync(tmpDir);
    } catch (e) {}
  });

  try {
    /*
      analyze the video file
    */
    const mediaInfo = await util.promisify(ffmpeg.ffprobe)(args.filename);
    console.log(JSON.stringify(mediaInfo, false, 2));

    const metadata = {
      transcoder_version: "0.1.0",
      dashStream: "stream.mpd",
      hlsStream: "master.m3u8",
      subtitles: {},
      capabilities: ["dash", "hls", "subtitles"]
    };

    // scan for subtitles
    // TODO: find a good way to include separate .srt files from the disk and add them!
    //       this will likely require coding an additional utility that can sweep the disk for .srt's, check if they are included, and if not translate and upload them.
    console.log("scanning for subtitles to extract");
    let imageSubtitlesIdx = -1;
    const subtitleStreams = {};
    for (const stream of mediaInfo.streams) {
      if (
        stream.codec_type === "subtitle" ||
        stream.codec_name.indexOf("text") !== -1
      ) {
        if (
          stream.codec_name.indexOf("text") !== -1 ||
          stream.codec_name === "ass" ||
          stream.codec_name === "ssa"
        ) {
          console.log(
            "\tfound subtitles, language: " +
              stream.tags.language +
              " on stream #" +
              stream.index
          );
          let language;
          if (stream.tags.language === "und") language = ".eng";
          else language = "." + stream.tags.language;

          if (subtitleStreams[language]) {
            console.log(
              "\t\talready have subtitles for language '" +
                language +
                "' skipping."
            );
            continue;
          }
          subtitleStreams[language] = stream;

          const subtitleFile = "subtitles" + language + ".vtt";
          await extractSubtitleStream(
            args.filename,
            stream.index,
            path.join(tmpDir, subtitleFile)
          );
          metadata.subtitles[stream.tags.language] = {
            file: subtitleFile
          };
        } else {
          console.log("\tfound video subtitles, index: " + stream.index);
          imageSubtitlesIdx = stream.index;
          break;
        }
      }
    }

    // select the audio stream to keep
    let videoStreamIdx = -1;
    for (const stream of mediaInfo.streams) {
      if (stream.codec_type === "video") {
        videoStreamIdx = stream.index;
      }
    }

    if (!videoStream)
      throw new Error(args.filename + " was unable to find a video stream");

    const videoStream = mediaInfo.streams[videoStreamIdx];

    // NOTE: todo burn in the subtitles
    // if (imageSubtitlesIdx !== -1) {
    //   throw new Error(args.filename + " uses image subtitle stream at index: " + imageSubtitlesIdx);
    //   // going to wind up being something like this: // ffmpeg -i input.mkv -filter_complex "[0:v][0:s]overlay[v]" -map "[v]" -map 0:a <output options> output.mkv
    // }

    if (imageSubtitlesIdx !== -1) {
      console.log(
        "Image subtitles at index: " +
          imageSubtitlesIdx +
          ", at somepoint we need to decide how to handle these."
      );
    }

    console.log("using video at stream #" + videoStreamIdx + ".");

    const proc = ffmpeg({
      source: args.filename,
      cwd: tmpDir
    });

    // console.log("setting up fallback.mp4 generation");
    // proc
    //   .output(path.join(tmpDir, `fallback.mp4`))
    //   .format('mp4')
    //   .videoCodec('libx264')
    //   .addOptions(['-crf 20', '-maxrate 2M', '-bufsize 2M'])
    //   .size(`?x${ Math.min(720, videoStream.height) }`)
    //   .audioCodec('aac')
    //   .audioChannels(2)
    //   .audioFrequency(44100)
    //   .outputOptions([
    //     '-preset fast',
    //     '-movflags +faststart',
    //     '-keyint_min 60',
    //     '-refs 5',
    //     '-g 60',
    //     '-pix_fmt yuv420p',
    //     '-sc_threshold 0',
    //     '-profile:v main',
    //     "-map_metadata", "-1",
    //     "-profile:v baseline",
    //     '-map 0:v:0',
    //     '-map 0:a:' + _.filter(mediaInfo.streams, (stream) => {
    //       return stream.index < audioStreamIdx && stream.codec_type === "audio"
    //     }).length,
    //     '-b:a 196k',
    //   ]);

    /*
      calculate thes sizes and bitrates for this video 
    */

    console.log("generating dash manifest and video sequences");
    const calcBitrateForSize = (width, height) => {
      const baseMaxBitrate = 6000;
      const baseMaxBitrateFrameSize = 1920 * 1080;
      const resRatio = (width * height) / baseMaxBitrateFrameSize;
      return Math.min(Math.round(baseMaxBitrate * resRatio), 16000);
    };

    // calculate an array of video sizes
    const videoStreamAspect = videoStream.width / videoStream.height;

    const widthForHeight = height => {
      return Math.round(height * videoStreamAspect);
    };

    console.log(
      "Original video stream width: " +
        videoStream.width +
        " height: " +
        videoStream.height +
        " aspect: " +
        videoStreamAspect
    );

    const sizes = [];
    {
      const videoMinHeight = 480; // always include a 480p stream
      if (videoMinHeight < videoStream.height * 0.8) {
        sizes.push({
          height: videoMinHeight,
          width: widthForHeight(videoMinHeight),
          bitrate: calcBitrateForSize(
            widthForHeight(videoMinHeight),
            videoMinHeight
          )
        });
      }
    }

    // insert optional 1080p stream if video is greater than 1080p resolution
    {
      if (videoStream.height > 1080) {
        sizes.push({
          height: 1080,
          width: widthForHeight(1080),
          bitrate: calcBitrateForSize(widthForHeight(1080), 1080)
        });
      }
    }

    // insert original resolution stream
    sizes.push({
      height: videoStream.height,
      width: videoStream.width,
      bitrate: calcBitrateForSize(videoStream.height, videoStream.width)
    });

    sizes.sort((a, b) => {
      return a.height - b.height;
    });
    metadata.sizes = sizes;

    console.log("producing video at sizes:", JSON.stringify(sizes, false, 3));

    proc
      .output(path.join(tmpDir, "stream.mpd"))
      .format("dash")
      .videoCodec("libx264")
      .audioCodec("aac")
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
        "-preset fast",
        "-keyint_min 60",
        "-g 60",
        "-sc_threshold 0",
        "-profile:v high",
        "-use_template 1",
        "-use_timeline 1",
        "-b_strategy 0",
        "-bf 1",
        "-map 0:a",
        "-b:a 196k",
        "-hls_playlist 1",
        "-seg_duration 10",
        "-max_muxing_queue_size 1024" // fixes a bug with some files
      ]);

    for (const size of sizes) {
      let index = sizes.indexOf(size);

      const bitrate = size.bitrate;

      proc.outputOptions([
        `-filter_complex [0]format=pix_fmts=yuv420p[temp${index}];[temp${index}]scale=-2:${size.height}[A${index}]`,
        `-map [A${index}]:v`,
        `-crf 24`,
        `-maxrate ${bitrate}k`,
        `-bufsize ${bitrate * 2}k`
      ]);
    }

    await waitForFFmpeg(proc);

    // compute the size of the output files
    {
      const files = fsutil.dirtree(tmpDir);
      metadata.stream_size_bytes = 0;

      for (const filepath of files) {
        metadata.stream_size_bytes += fs.statSync(filepath).size;
      }

      console.log(
        `transcoding complete, stream is ${prettyBytes(
          metadata.stream_size_bytes
        )} MB`
      );
    }

    try {
      rimraf(args.outputdir);
    } catch (e) {}

    fs.renameSync(tmpDir, args.outputdir);

    return metadata;
  } catch (e) {
    rimraf.sync(tmpDir);
    throw e;
  }
};
