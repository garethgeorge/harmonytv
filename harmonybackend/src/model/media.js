const pgformat = require("pg-format");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const debug = require("debug")("model:media");
const config = require("../config");
const crypto = require("crypto");
const AsyncLock = require("async-lock");
const LRU = require("lru-cache");
const stream_helpers = require("../util/stream_helpers");

let storageBackend = null;

module.exports.setup = async (setup) => {
  // bit of a race condition here but it makes life much easier to just live w/it
  debug("initializing cloud data stores");

  const gdriveBackend = await require("../storage-backends/gdrive")(
    config.gdrive.parentFolder
  );
  const cryptBackend = await require("../storage-backends/crypt")(
    gdriveBackend
  );

  storageBackend = cryptBackend;
  exports.storageBackend = storageBackend;
};

module.exports.getMediaInfo = async (mediaid, conn = null) => {
  if (!conn) conn = pool;

  const res = await conn.query(
    pgformat(`SELECT * FROM media WHERE mediaid = %L`, mediaid)
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
};

/*
 * returns the episodes of a series as well as the fraction they have been watched
 */
module.exports.seriesGetEpisodes = async (seriesname, conn = null) => {
  if (!conn) conn = pool;

  const res = await conn.query(
    pgformat(
      `
        SELECT media.*, position::float / total_duration::float AS completed_fraction
        FROM media 
        LEFT JOIN user_resume_watching ON user_resume_watching.mediaid = media.mediaid
        WHERE seriesname = %L
      `,
      seriesname
    )
  );

  return res.rows;
};

module.exports.objectGetParentMedia = async (objectid, conn = null) => {
  if (!conn) conn = pool;
  const res = await conn.query(
    pgformat(`SELECT * FROM media_objects WHERE objectid = %L`, objectid)
  );

  if (res.rows.length === 0) return null;
  return res.rows[0];
};

const mimetypes = {
  ".mp4": "video/mp4",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  ".vtt": "text/vtt",
  ".m3u8": "application/x-mpegURL",
  ".js": "application/javascript",
};

exports.mimetypes = mimetypes;

exports.putStreamObject = async (mediaid, uploadDir, file, conn = null) => {
  if (!conn) conn = pool;

  const mimetype = mimetypes[path.extname(file)];
  if (!mimetype) {
    throw new Error("mimetype not found for file " + path);
  }

  // retries for up to 100 seconds until it succeeds
  const encryptionKey = crypto.randomBytes(32).toString("hex");

  let blockId = null;
  let retry_time = 2;
  while (true) {
    try {
      const objectStream = fs.createReadStream(path.join(uploadDir, file));
      blockId = await storageBackend.putBlock(
        objectStream,
        mimetype,
        encryptionKey
      );
      break;
    } catch (e) {
      if (retry_time > 15 * 60) {
        throw e;
      }
      console.log(
        `putStreamObject(${mediaid}, ${file}, ...) encountered an error: ${e}, retrying in ${retry_time} seconds`
      );
      await new Promise((accept, reject) => {
        setTimeout(accept, retry_time);
      });
      retry_time *= 2;
    }
  }

  debug(
    `putStreamObject(${mediaid}, ${file}, ...) - stored as blockid ${blockId}, inserting in database`
  );

  await conn.query(
    pgformat(
      "INSERT INTO media_objects (mediaId, path, objectid, encryptionkey) VALUES (%L, %L, %L, %L)",
      mediaid,
      file,
      blockId,
      encryptionKey
    )
  );

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
    if (this.cache[key]) clearTimeout(this.cache[key].timeout);

    this.cache[key] = {
      timeout: setTimeout(() => {
        delete this.cache[key];
      }, this.timeout),
      value: value,
    };
  }

  get(key) {
    if (!this.cache[key]) return null;

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

const objectCache = new Cache(config.inMemoryObjectCacheDuration * 1000);
// const objectCache = new LRU({
//   max: config.inMemoryObjectCacheSize,
//   length: (obj, key) => {
//     debug("computed length for %o to be %o", key, obj.length);
//     return obj.length;
//   },
//   dispose: (key, obj) => {
//     debug("cache disposing of old object: " + key);
//   },
//   maxAge: config.inMemoryObjectCacheDuration * 1000,
// });
// setInterval(() => {
//   debug("attempting to prune the object cache");
//   objectCache.prune();
// }, 30 * 1000);

const objectCacheLock = new AsyncLock();

exports.getStreamObject = async (mediaid, objectid, conn = null) => {
  if (!conn) conn = pool;

  return await objectCacheLock.acquire(objectid, async (callback) => {
    debug(`getStreamObject(${mediaid}, ${objectid})`);
    try {
      // check the cache
      const cacheObject = objectCache.get(objectid);
      if (cacheObject) {
        debug("\tHIT THE CACHE :)");
        return callback(null, cacheObject);
      }
      debug("\tMISSED THE CACHE");

      // we will have to get and decrypt it, fetch the encryption key
      let encryptionKey = null;
      const res = await conn.query(
        pgformat(
          "SELECT encryptionkey FROM media_objects WHERE objectid = %L",
          objectid
        )
      );
      if (res.rows.length > 0) {
        debug(
          "getStreamObject(...): encryptionkey: ",
          res.rows[0].encryptionkey
        );
        if (res.rows[0].encryptionkey)
          encryptionKey = res.rows[0].encryptionkey.trim();
      }

      // get the object
      const object = await storageBackend.getBlock(objectid, encryptionKey);
      object.data = await stream_helpers.streamToBuffer(object.stream);
      delete object.stream;
      objectCache.set(objectid, object);

      debug(
        `\t\tfetched object ${objectid} successfully, caching it and returning it`
      );

      callback(null, object);
    } catch (e) {
      callback(e);
    }
  });
};

// given a mediaid and a path returns the objectid for that path
exports.mediaObjectIdByPath = async (mediaid, path, conn = null) => {
  if (!conn) conn = pool;

  const res = await conn.query(
    pgformat(
      "SELECT objectId FROM media_objects WHERE mediaId = %L AND path = %L",
      mediaid,
      path
    )
  );

  if (res.rows.length === 0) return null;

  return res.rows[0].objectid;
};
