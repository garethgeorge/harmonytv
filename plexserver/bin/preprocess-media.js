const ArgumentParser = require('argparse').ArgumentParser;
const path = require('path');
const transcoder = require("../src/transcoder/transcoder");

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
transcoder(args);
