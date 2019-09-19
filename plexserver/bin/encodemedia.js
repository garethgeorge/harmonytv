const ArgumentParser = require('argparse').ArgumentParser;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const _ = require('lodash');
var fs = require('fs');
const cliprogress = require('cli-progress');

parser = new ArgumentParser({
  help: true, 
  description: "command line tool for uploading a video to plex"
});

parser.addArgument(
  'filename',
  {
    help: 'the file to encode',
  }
);

parser.addArgument(
  'outputdir',
  {
    help: "the output directory to put the files in"
  }
)

const args = parser.parseArgs();
const fn = args.filename;

ffmpeg.ffprobe(fn, (err, metadata) => {
  console.log("video metadata: ");
  console.log(metadata);

  const videoStream = _.find(metadata.streams, (obj) => obj["codec_type"] === "video");

  // TODO: think some more about how exactly to setup the encoding, preferably 
  // with two pass encoding for target bitrates 

  // height, bitrate
  const baseVideoHeight = videoStream.height;
  let baseVideoBitrate = Math.min(videoStream.bit_rate, 3500);
  if (baseVideoHeight > 1080)
    baseVideoBitrate = videoStream.bit_rate; // 8 mbps 4k
  
  const sizes = [
    [Math.round(videoStream.height * (2.0 / 3.0)), baseVideoBitrate / 2],
    [baseVideoHeight, baseVideoBitrate],
  ];

  const fallbackHeight = Math.min(baseVideoHeight, 720);
  const fallbackBitrate = 1500;

  
  let name = path.basename(fn, path.extname(fn));
  const targetdir = path.resolve(args.outputdir);
  const sourcefn = path.resolve(fn);

  console.log('source', sourcefn);
  console.log('info', sizes);
  console.log('info', targetdir);

  try {
      var targetdirInfo = fs.statSync(targetdir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.mkdirSync(targetdir);
    } else {
      throw err;
    }
  }

  var proc = ffmpeg({
      source: sourcefn,
      cwd: targetdir
  });

  var targetfn = path.join(targetdir, `stream.mpd`);

  proc
      .output(targetfn)
      .format('dash')
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
          '-preset medium',
          '-keyint_min 60',
          '-g 60',
          '-sc_threshold 0',
          '-profile:v high',
          '-use_template 1',
          '-use_timeline 1',
          '-b_strategy 0',
          '-bf 1',
          '-map 0:a',
          '-b:a 196k'
      ]);


  for (var size of sizes) {
      let index = sizes.indexOf(size);

      proc
          .outputOptions([
              `-filter_complex [0]format=pix_fmts=yuv420p[temp${index}];[temp${index}]scale=-2:${size[0]}[A${index}]`,
              `-map [A${index}]:v`,
              `-b:v:${index} ${size[1]}k`,
          ]);
  }

  //Fallback version
  proc
    .output(path.join(targetdir, `original.mp4`))
    .format('mp4')
    .videoCodec('libx264')
    .addOptions(['-crf 20', '-maxrate 10M', '-bufsize 20M'])
    .audioCodec('aac')
    .audioChannels(2)
    .audioFrequency(44100)
    .audioBitrate(128)
    .outputOptions([
        '-preset medium',
        '-movflags +faststart',
        '-keyint_min 60',
        '-refs 5',
        '-g 60',
        '-pix_fmt yuv420p',
        '-sc_threshold 0',
        '-profile:v main',
        "-map_metadata", "-1",
    ]);

  proc.on('start', function(commandLine) {
      console.log('progress', 'Spawned Ffmpeg with command: ' + commandLine);
  });

  proc.run();

  const bar = new cliprogress.SingleBar({}, cliprogress.Presets.shades_classic);
  bar.start(100, 0);
  proc.on('progress', function(info) {
          // console.log('progress', info);
          bar.update(Math.floor(info.percent * 100) / 100);
      })
      .on('end', function() {
          console.log('complete');
          bar.stop();
      })
      .on('error', function(err) {
          console.log('error', err);
          bar.stop();
      });
});

