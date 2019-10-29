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
    console.log("LIBRARY TYPE: " + library.librarytype);

    let newMediaInfo = null;

    const mediainfo = require("../src/transcoder/mediainfo");
    if (library.librarytype === "tv") {
      newMediaInfo = mediainfo.infoFromEpisodePath(args.originPath);
      console.log("PARSED PATH INFORMATION");
      console.log("\tmedia name: " + newMediaInfo.niceName);
      console.log("\tseries name: " + newMediaInfo.seriesName);
      console.log("\tseason number: " + newMediaInfo.seasonNumber);
      console.log("\tepisode number: " + newMediaInfo.episodeNumber);
    } else if (library.librarytype === "movies") {
      newMediaInfo = mediainfo.infoFromMoviePath(args.originPath);
      console.log("PARSED PATH INFORMATION");
      console.log("\tmedia name: " + newMediaInfo.niceName);
    } else 
      throw new Error("no path parsing implemented for other library type: " + library.librarytype + " at the moment.");
    
    /*
      optionally transcode if necessary
    */
    console.log("checking the originPath: " + args.originPath);
    if (!fs.lstatSync(args.originPath).isFile()) {
      console.log("Fatal error: args.originalPath must point to a valid file");
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

    // get the sizes of all the files
    // TODO: use a fsutil here that can be tested independently :P 

    // creating a new media object
    const mediaId = uuidv4();
    if (library.librarytype === "tv") {
      await client.query(pgformat(`
        INSERT INTO media
        (mediaId, libraryId, name, originPath, metadata, seriesName, seasonNumber, episodeNumber)
        VALUES (%L, %L, %L, %L, %L, %L, %L, %L)
      `, mediaId, library.libraryid, newMediaInfo.niceName,
        args.originPath, JSON.stringify(metadata),
        newMediaInfo.seriesName, newMediaInfo.seasonNumber, newMediaInfo.episodeNumber
      ));
    } else if (library.librarytype === "movies") {
      await client.query(pgformat(`
        INSERT INTO media
        (mediaId, libraryId, name, originPath, metadata)
        VALUES (%L, %L, %L, %L, %L)
      `, mediaId, library.libraryid, newMediaInfo.niceName,
        args.originPath, JSON.stringify(metadata)
      ));
    }
    
    console.log("inserted new media with id: " + mediaId);

    // TODO: parallelize this again, this was disabled for the time being due 
    // to some errors during upload resulting in corrupted files
    const uploadQueue = async.queue((file, callback) => {
      (async () => {
        try {
          const mimetype = model.media.mimetypes[path.extname(file)];
          if (!mimetype) {
            console.log("\tskipping file " + file + " mimetype not recognized");
            callback(new Error("\tskipping file " + file + " mimetype not recognized"));
            return ;
          }

          console.log(`uploading file ${file} with mimetype ${mimetype}`);
          const blockId = await model.media.putStreamObject(mediaId, uploadDir, file, client);
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