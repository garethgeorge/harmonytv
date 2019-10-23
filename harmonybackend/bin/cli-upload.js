const ArgumentParser = require('argparse').ArgumentParser;
const _ = require('lodash');
const fs = require("fs");
const fsutil = require("../src/util/fsutil");
const mkdirpsync = require("mkdirpsync");
const model = require('../src/model');
const path = require("path");
const pgformat = require('pg-format');
const process = require("process");
const rimraf = require('rimraf');
const uuidv4 = require('uuid/v4');
const os = require("os");
const async = require("async");

// const TVDB = require('node-tvdb');
// const tvdb = new TVDB("FVPW8O55SRM7SMNJ");

parser = new ArgumentParser({
  help: true, 
  description: "command line tool for uploading a video to plex"
});

parser.addArgument(
  'library',
  {
    help: 'the name of the library it belongs to',
  }
);

parser.addArgument(
  'originPath',
  {
    help: 'the path to the file to be uploaded, it will be transcoded before uploading',
  }
);

const args = parser.parseArgs();
args.originPath = path.resolve(args.originPath);

// mimetypes
const mimetypes = {
  ".mp4": "video/mp4",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  ".vtt": "text/vtt",
};

(async () => {
  // const series = await tvdb.getSeriesByName('Breaking Bad');
  // console.log(series[0].id);
  // const episodes = await tvdb.getEpisodesBySeriesId(series[0].id);
  // console.log(series);
  // console.log(episodes);

  const uploadDir = path.join(os.tmpdir(), "/plex_uploader/" + uuidv4());
  console.log("upload directory " + uploadDir);
  mkdirpsync(uploadDir);

  await model.setup();

  const client = await model.getClient();
  try {
    /*
      decode path information for the media asset
    */
    const library = await model.getLibraryByName(args.library);
    if (library === null) {
      console.log("Error: no library with name '" + args.library + "'");
      console.log("Did you mean one of the following: ", (await model.getAllLibraries()).map((library) => {
        return library.libraryname;
      }));
      process.exit(1);
    }
    const libraryId = library.libraryid;
    console.log("LIBRARY TYPE: " + library.librarytype);

    let mediaName = null;
    let seriesName = null;
    let seasonNumber = null;
    let episodeNumber = null;

    if (library.librarytype === "tv") {
      const mediainfo = require("../src/transcoder/mediainfo");
      const info = mediainfo.infoFromEpisodePath(args.originPath);
      mediaName = info.niceName;
      seriesName = info.seriesName;
      seasonNumber = info.seasonNumber;
      episodeNumber = info.episodeNumber;
    } else 
      throw new Error("no path parsing implemented for Movies at the moment");
    
    console.log("PARSED PATH INFORMATION");
    console.log("\tmedia name: " + mediaName);
    console.log("\tseries name: " + seriesName);
    console.log("\tseason number: " + seasonNumber);
    console.log("\tepisode number: " + episodeNumber);

    /*
      optionally transcode if necessary
    */
    console.log("checking the originPath: " + args.originPath);
    if (!fs.lstatSync(args.originPath).isFile()) {
      console.log("Fatal error: args.originalPath must be a file, transcoding is required");
      return ;
    }

    console.log("determined origin path is a file, we need to transcode.");
    const transcoder = require("../src/transcoder/transcoder"); // lazy import only if we need it

    const metadata = await transcoder({
      filename: args.originPath,
      outputdir: uploadDir
    });

    console.log("transcode completed! metadata: " + JSON.stringify(metadata, false, 3));

    /*
      scan files for upload 
    */

    const files = _.filter(fsutil.dirtree(uploadDir), (f) => {
      if (f.endsWith('.DS_Store'))
        return false;
      return true;
    }).map((value) => {
      return path.relative(uploadDir, value);
    });
    
    /*
      upload the media assets
    */
    await client.query("BEGIN");

    // creating a new media object
    const mediaId = uuidv4();
    await client.query(pgformat(`
      INSERT INTO media
      (mediaId, libraryId, name, originPath, metadata, seriesName, seasonNumber, episodeNumber)
      VALUES (%L, %L, %L, %L, %L, %L, %L, %L)
    `, mediaId, libraryId, mediaName,
       args.originPath, JSON.stringify(metadata),
       seriesName, seasonNumber, episodeNumber)
    );
    
    console.log("inserted new media with id: " + mediaId);

    // TODO: parallelize this again, this was disabled for the time being due 
    // to some errors during upload resulting in corrupted files
    const uploadQueue = async.queue((file, callback) => {
      (async () => {
        try {
          const mimetype = mimetypes[path.extname(file)];
          if (!mimetype) {
            console.log("\tskipping file " + file + " mimetype not recognized");
            return ;
          }

          console.log(`uploading file ${file} with mimetype ${mimetype}`);
          const blockId = await model.putStreamObject(mediaId, uploadDir, file, client);
          callback();
        } catch (e) {
          console.log(`UPLOAD ENCOUNTERED ERROR ON FILE: ${file}, error: ${e}`);
          callback(e);
        }
      })();
    }, 4);

    for (const file of files) {
      uploadQueue.push(file);
    }

    await uploadQueue.drain();
    
    // verify that all of the uploads completed successfully
    for (const file of files) {
      const res = await client.query(pgformat("SELECT objectid FROM media_objects WHERE mediaId = %L AND path = %L", mediaId, file))
      if (res.rows.length === 0)
        throw new Error("failed to find file " + file + " in media_objects");
      console.log(`validating, file ${file} was uploaded as ${res.rows[0].objectid}`);
    }
    
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    model.shutdown();

    if (uploadDir != args.originPath) {
      rimraf.sync(uploadDir);
    }
  }
})();