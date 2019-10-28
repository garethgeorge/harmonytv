const { Pool, Client } = require('pg')
const pgformat = require('pg-format');
const config = require("../config");
const uuidv4 = require('uuid/v4');
const path = require("path");
const StreamCache = require('stream-cache');
const LRU = require('lru-cache');
const AsyncLock = require('async-lock');
const debug = require("debug")("model");
const fs = require("fs");
const crypto = require("crypto");
const {migrate} = require("postgres-migrations")

const pool = require("./db");

let mediaStore = null;

exports.pool = pool;
exports.user = require("./user");
exports.media = require("./media");

exports.setup = async (conn = null) => {
  // bit of a race condition here but it makes life much easier to just live w/it 
  debug("initializing cloud data stores");
  // TODO: move this setup code to the config
  mediaStore = await require('../storage-backends/gdrive')();
  await mediaStore.setGdriveRootFolderId(config.gdrive.parentFolder);
  exports.mediaStore = mediaStore;

  debug("initializing database and running migrations");
  await migrate(config.pg, "./src/db-migrations/", {
    logger: require("debug")("model:migrate")
  });
}

exports.shutdown = () => {
  pool.end();
}

// direct access to a client can be needed for supporting transactional insertions
exports.getClient = async () => {
  return await pool.connect();
}

const mimetypes = {
  ".mp4": "video/mp4",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  ".vtt": "text/vtt",
  ".m3u8": "application/x-mpegURL", 
};
exports.mimetypes = mimetypes;

exports.putStreamObject = async (mediaid, uploadDir, file, conn=null) => {
  if (!conn)
    conn = pool;

  const mimetype = mimetypes[path.extname(file)];
  if (!mimetype) {
    throw new Error("mimetype not found for file " + path);
  }

  
  // retries for up to 100 seconds until it succeeds
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  let blockId = null;
  let retry_time = 2;
  while (true) {
    try {
      const objectStream = fs.createReadStream(path.join(uploadDir, file));
      blockId = await mediaStore.putBlock(objectStream, mimetype, encryptionKey);
      break ;
    } catch (e) {
      if (retry_time > 15 * 60) {
        throw e;
      }
      console.log(`putStreamObject(${mediaid}, ${file}, ...) encountered an error: ${e}, retrying in ${retry_time} seconds`);
      await new Promise((accept, reject) => {
        setTimeout(accept, retry_time);
      });
      retry_time *= 2;
    }
  }
  
  debug(`putStreamObject(${mediaid}, ${file}, ...) - stored as blockid ${blockId}, inserting in database`);

  await conn.query(pgformat(
    "INSERT INTO media_objects (mediaId, path, objectid, encryptionkey) VALUES (%L, %L, %L, %L)",
    mediaid, file, blockId, encryptionKey
  ));

  return blockId;
};

// TODO: make more specific / useful
exports.getStreamObjectIdFromPath = async (mediaid, path, conn = null) => {
  if (!conn)
    conn = pool;

  const res = await conn.query(pgformat(
    "SELECT objectId FROM media_objects WHERE mediaId = %L AND path = %L",
    mediaid, path
  ));

  if (res.rows.length === 0)
    return null;
  
  return res.rows[0].objectid;
}

exports.getLibraryByName = async (libraryName, conn = null) => {
  if (!conn)
    conn = pool;
  const res = await conn.query(pgformat("SELECT * FROM libraries WHERE libraryName = %L", libraryName));
  if (res.rows.length === 0)
    return null;
  return res.rows[0];
}

exports.getAllLibraries = async (conn = null) => {
  if (!conn)
    conn = pool;
  const res = await conn.query("SELECT * FROM libraries");
  return res.rows;
}

exports.libraryGetAllMedia = async (libraryId, conn = null) => {
  if (!conn)
    conn = pool;

  const res = await conn.query(pgformat("SELECT * FROM media WHERE libraryId = %L", libraryId));
  return res.rows;
}

/*
  fetches object from the media store with 'mediaid' and 'objectid'
*/
const objectCache = new LRU({
  max: config.inMemoryObjectCacheSize, // 64 megabyte in memory object cache
  maxAge: 1000 * config.inMemoryObjectCacheDuration,
  length: (obj) => {
    return obj.length;
  }
});
const objectCacheLock = new AsyncLock();
const alreadyFetched = {};

exports.getStreamObject = async (mediaid, objectid, conn=null) => {
  if (!conn)
    conn = pool;

  let encryptionKey = null;
  const res = await conn.query(pgformat("SELECT encryptionkey FROM media_objects WHERE objectid = %L", objectid));
  if (res.rows.length > 0) {
    debug("getStreamObject(...): encryptionkey: ", res.rows[0].encryptionkey);
    if (res.rows[0].encryptionkey)
      encryptionKey = res.rows[0].encryptionkey.trim();
  }

  return await objectCacheLock.acquire(objectid, (callback) => {
    debug(`getStreamObject(${mediaid}, ${objectid})`);

    // check the cache 
    const cacheObject = objectCache.get(objectid);
    if (cacheObject) {
      debug("\tHIT THE CACHE :)");
      return callback(null, cacheObject);
    }

    debug(`\tNOT CACHED :( fetching from backing store`);
    const object = mediaStore.getBlock(objectid, encryptionKey).then((object) => {
        // swap the object's stream with a stream cache 
      const stream = new StreamCache();
      object.stream.pipe(stream);
      object.stream = stream;

      debug(`\t\tfetched object ${objectid} successfully, caching it and returning it`);
      objectCache.set(objectid, object);

      callback(null, object);
    }).catch(callback);
  });
}
