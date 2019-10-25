const ArgumentParser = require('argparse').ArgumentParser;
const fs = require("fs");
const fsutil = require("../src/util/fsutil");
const path = require("path");
const mediainfo = require("../src/transcoder/mediainfo");
const pgformat = require("pg-format");
const debug = require("debug")("main");
const process = require("process");

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
  "--sort-newest-first",
  {
    help: 'order by the date the files were added so that newest files are first',
    action: 'storeTrue'
  }
)


const args = parser.parseArgs();

if (args.type !== "tv" && args.type !== "movies") {
  console.log("args.type must be 'tv' or 'movies'");
  return ;
}

// list all media files 
let filesList = fsutil.dirtree(path.resolve(args.dir));
filesList = filesList.filter((path) => mediainfo.mediaFileExtScore(path) !== -1);

// get their info and populate filesInfo array
let filesInfo = null;
if (args.type == "tv") {
  filesInfo = filesList.map(mediainfo.infoFromEpisodePath);
} else if (args.type == "movies") {
  filesInfo = filesList.map(mediainfo.infoFromMoviePath);
}

// order the files by quality, highest quality a the top via lexographic comparator
const lexographic_comparator = (a, b) => {
  for (let i = 0; i < a.length; ++i) {
    if (a[i] < b[i]) {
      return -1;
    } else if (a[i] > b[i]) 
      return 1;
  }
  return 0;
}

filesInfo.sort((a, b) => {
  return lexographic_comparator(
    [a.niceName, a.qualityScore, a.extScore],
    [b.niceName, b.qualityScore, b.extScore]
  );
});

// filter the files to include only the best quality copy of each
let uniqueHQFiles = filesInfo.filter((finfo, idx) => {
  return !(idx !== 0 && filesInfo[idx - 1].niceName === finfo.niceName);
});

// now reduce the set of files by checking the database for each :P
(async () => {
  const model = require("../src/model");
  let filesToProcess = [];

  for (const finfo of uniqueHQFiles) {
    if (args.type === "tv") {
      const res = await model.pool.query(pgformat(
        "SELECT * FROM media WHERE episodeNumber = %L AND seasonNumber = %L AND seriesName = %L",
        finfo.episodeNumber,
        finfo.seasonNumber,
        finfo.seriesName,
      ));
      if (res.rows.length === 0)
        filesToProcess.push(finfo);
    } else if (args.type === "movies") {
      const res = await model.pool.query(pgformat(
        "SELECT * FROM media WHERE name = %L",
        finfo.niceName,
      ));
      if (res.rows.length === 0)
        filesToProcess.push(finfo);
    }
  }

  if (args["sort_newest_first"]) {
    filesToProcess.forEach(finfo => {
      const timestamp = fs.statSync(finfo.originPath).ctime.getTime();
      finfo.createdTime = timestamp;
    });

    filesToProcess.sort((a, b) => {
      return b.createdTime - a.createdTime;
    });
  }

  process.stdout.write(filesToProcess.map(finfo => finfo.originPath).join("\n") + "\n");
  await model.shutdown();
})();
