const ArgumentParser = require('argparse').ArgumentParser;
const fs = require("fs");
const fsutil = require("../src/util/fsutil");
const path = require("path");
const mediainfo = require("../src/transcoder/mediainfo");
const pgformat = require("pg-format");
const debug = require("debug")("main");

parser = new ArgumentParser({
  help: true, 
  description: "command line tool for uploading a video to plex"
});

parser.addArgument(
  'dir',
  {
    help: 'the directory to scan for media to process',
  }
);

parser.addArgument(
  'type',
  {
    help: 'the type of the directory, must be \'tv\' or \'movies\'',
  }
);

const args = parser.parseArgs();

if (args.type !== "tv" && args.type !== "movies") {
  console.log("args.type must be 'tv' or 'movies'");
  return ;
}

let filesList = fsutil.dirtree(path.resolve(args.dir));
let filesInfo = null;
if (args.type == "tv") {
  files = filesList.map(mediainfo.infoFromEpisodePath);
} else if (args.type === "movies") {
  files = filesList.map(mediainfo.infoFromMoviePath);
}
console.log(filesInfo);

