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

parser.addArgument(
  '--processedFilesLog',
  {
    help: 'a log to which the full paths of files that have already been processed should be appended',
  }
);

const args = parser.parseArgs();

if (args.type !== "tv" && args.type !== "movies") {
  console.log("args.type must be 'tv' or 'movies'");
  return ;
}

const extensions = [
  ".flv.original",
  ".mkv.original",
  ".mov.original",
  ".mov",
  ".flv",
  ".mkv",
  ".mp4",
];

let files = fsutil.dirtree(path.resolve(args.dir));

if (args.processedFilesLog) {
  let processedFiles = fs.readFileSync(args.processedFilesLog).toString("utf-8").split("\n");
  processedFiles = processedFiles.filter((path) => {
    return path.trim() !== ""
  }).map((fpath) => {
    return path.resolve(fpath);
  });

  const processedFilesDict = {};
  for (const file of processedFiles) {
    processedFilesDict[file] = true;
  }

  files = files.filter((path) => {
    return !processedFilesDict[path];
  })
}

// group files by basename 
const files_grouped_by_base = {};

for (const file of files) {
  for (const extension of extensions) {
    if (file.endsWith(extension)) {
      const basename = path.basename(file.substr(0, file.length - extension.length));
      files_grouped_by_base[basename] = files_grouped_by_base[basename] || [];
      files_grouped_by_base[basename].push({
        "path": file, 
        "extension": extension,
        "priority": extensions.indexOf(extension)
      });
    }
  }
}


(async () => {
  const model = require("../src/model");
  try {
    const results = [];

    for (const key of Object.keys(files_grouped_by_base)) {
      const files = files_grouped_by_base[key];
      files.sort((a, b) => {
        return a.priority - b.priority;
      });

      const bestFile = files[0];
      if (args.type === "tv") {
        try {
          const episodeInfo = mediainfo.infoFromEpisodePath(bestFile.path);
          const res = await model.pool.query(pgformat(
            "SELECT * FROM media WHERE episodeNumber = %L AND seasonNumber = %L AND seriesName = %L",
            episodeInfo.episodeNumber,
            episodeInfo.seasonNumber,
            episodeInfo.seriesName,
          ));

          if (res.rows.length === 0) {
            results.push(bestFile.path);
          } else 
            debug("excluding ", bestFile.path, " because database indicates it is alraedy uploaded");
        } catch (e) {
          debug("mediainfo.infoFromEpisodePath encountered error: ", e);
        }
        
      } else if (args.type === "movies") 
        throw new Error("no rules for identifying 'movies' yet");
      else 
        throw new Error("unknown library type");
    }

    for (const row of results) {
      console.log(row);
    }
  } finally {
    model.shutdown();
  }
})();