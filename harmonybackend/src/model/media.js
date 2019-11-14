const pgformat = require('pg-format');
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const debug = require("debug")("model:media");
const config = require("../config");
const crypto = require("crypto");
const AsyncLock = require('async-lock');
const StreamCache = require('stream-cache');

let storageBackend = null;

module.exports.setup = async (setup) => {
  // bit of a race condition here but it makes life much easier to just live w/it 
  debug("initializing cloud data stores");

  const gdriveBackend = await require("../storage-backends/gdrive")(config.gdrive.parentFolder);
  const cryptBackend = await require("../storage-backends/crypt")(gdriveBackend);

  storageBackend = cryptBackend;
  exports.storageBackend = storageBackend;
}

module.exports.getMediaInfo = async (mediaid, conn=null) => {
  if (!conn)
    conn = pool;
  
  const res = await conn.query(pgformat(`SELECT * FROM media WHERE mediaid = %L`, mediaid));
  if (res.rows.length === 0)
    return null;
  return res.rows[0];
}

module.exports.objectGetParentMedia = async (objectid, conn=null) => {
  if (!conn)
    conn = pool;
  const res = await conn.query(pgformat(
    `SELECT * FROM media_objects WHERE objectid = %L`, objectid
  ));

  if (res.rows.length === 0)
    return null;
  return res.rows[0];
}

const mimetypes = {
  ".mp4": "video/mp4",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  ".vtt": "text/vtt",
  ".m3u8": "application/x-mpegURL", 
  ".js": "application/javascript",
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
      blockId = await storageBackend.putBlock(objectStream, mimetype, encryptionKey);
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

/*
  fetches object from the media store with 'mediaid' and 'objectid'
*/
class Cache {
  constructor(timeout) {
    this.cache = {};
    this.timeout = timeout; 
  }

  set(key, value) {
    if (this.cache[key]) 
      clearTimeout(this.cache[key].timeout);

    this.cache[key] = {
      timeout: setTimeout(() => {
        delete this.cache[key];
      }, this.timeout),
      value: value,
    }
  }

  get(key) {
    if (!this.cache[key])
      return null;

    clearTimeout(this.cache[key].timeout);
    this.cache[key].timeout = setTimeout(() => {
      delete this.cache[key];
    }, this.timeout);

    return this.cache[key].value;
  }

  size() {
    return Object.keys(this.cache).length;
  }
}

const objectCache = new Cache(config.inMemoryObjectCacheDuration);
const objectCacheLock = new AsyncLock();

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
    const object = storageBackend.getBlock(objectid, encryptionKey).then((object) => {
        // swap the object's stream with a stream cache 
      const stream = new StreamCache();
      object.stream.pipe(stream);
      object.stream = stream;

      debug(`\t\tfetched object ${objectid} successfully, caching it and returning it`);
      objectCache.set(objectid, object);
      debug(`\t\tthere are ${objectCache.size()} items in the cache`);

      callback(null, object);
    }).catch(callback);
  });
}


// given a mediaid and a path returns the objectid for that path 
exports.mediaObjectIdByPath = async (mediaid, path, conn = null) => {
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
