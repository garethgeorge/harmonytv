const { Pool, Client } = require('pg')
const pgformat = require('pg-format');
const config = require("./config");
const uuidv4 = require('uuid/v4');
const path = require("path");
const StreamCache = require('stream-cache');
const LRU = require('lru-cache');
const AsyncLock = require('async-lock');
const debug = require("debug")("model");
const fs = require("fs");

let mediaStore = null;
let cacheStore = null;

/*
  setup the database and the media sources
*/
const pool = new Pool(config.pg);

exports.setup = async (conn = null) => {
  if (!conn) 
    conn = pool;

  // bit of a race condition here but it makes life much easier to just live w/it 
  debug("initializing cloud data stores");
  mediaStore = await require('./storage-backends/gdrive')();
  await mediaStore.setGdriveRootFolderId(config.gdrive.parentFolder);
  
  debug("initializing database");

  try {
    await conn.query(`
      CREATE TYPE TLibrary AS ENUM ('movies', 'tv')
    `);
  } catch (e) { };

  await conn.query(`
    CREATE TABLE IF NOT EXISTS libraries (
      libraryId VARCHAR(100) PRIMARY KEY NOT NULL,
      libraryName VARCHAR(100) NOT NULL,
      libraryType TLibrary
    )
  `);

  // TODO: drop the origin path column from media
  await conn.query(`
    CREATE TABLE IF NOT EXISTS media (
      mediaId VARCHAR(100) PRIMARY KEY NOT NULL, 
      libraryId VARCHAR(100) NOT NULL, 
      name VARCHAR(512) NOT NULL,
      originPath VARCHAR(512) NOT NULL, 
      metadata JSON NOT NULL,
      seriesName VARCHAR(512),
      seasonNumber INTEGER,
      episodeNumber INTEGER,
      UNIQUE (seriesName, seasonNumber, episodeNumber),
      FOREIGN KEY (libraryId) REFERENCES libraries (libraryId) ON DELETE CASCADE
    );
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS media_objects (
      mediaId VARCHAR(100) NOT NULL, 
      path VARCHAR(100) NOT NULL, 
      objectId VARCHAR(100) UNIQUE NOT NULL, 
      PRIMARY KEY (mediaId, path),
      FOREIGN KEY (mediaId) REFERENCES media (mediaId) ON DELETE CASCADE
    );
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS cache (
      sourceObjectId VARCHAR(100) PRIMARY KEY NOT NULL, 
      cacheObjectId VARCHAR(100) NOT NULL,
      FOREIGN KEY (sourceObjectId) REFERENCES media_objects (objectId) ON DELETE CASCADE
    );
  `);

  await conn.query(`
    CREATE INDEX IF NOT EXISTS mediaObjectsObjectIdIndex ON media_objects (objectId)
  `);
  
  await conn.query(`
    CREATE INDEX IF NOT EXISTS mediaSeriesIndex ON media (seriesName, seasonNumber) 
    WHERE seriesName IS NOT NULL AND seasonNumber IS NOT NULL
  `);

  await conn.query(`
    CREATE INDEX IF NOT EXISTS mediaLibraryIndex ON media (libraryId)
  `);
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
};

exports.putStreamObject = async (mediaid, uploadDir, file, conn=null) => {
  if (!conn)
    conn = pool;

  const mimetype = mimetypes[path.extname(file)];
  if (!mimetype) {
    throw new Error("mimetype not found for file " + path);
  }

  // retries for up to 100 seconds until it succeeds
  let blockId = null;
  for (let i = 0; i < 10; ++i) {
    try {
      const objectStream = fs.createReadStream(path.join(uploadDir, file));
      blockId = await mediaStore.putBlock(objectStream, mimetype);
      break ;
    } catch (e) {
      console.log(`putStreamObject(${mediaid}, ${file}, ...) encountered an error: ${e}, retrying ${i}`);
      await new Promise((accept, reject) => {
        setTimeout(accept, 10 * 1000);
      });
    }
  }
  
  debug(`putStreamObject(${mediaid}, ${file}, ...) - stored as blockid ${blockId}, inserting in database`);

  await conn.query(pgformat(
    "INSERT INTO media_objects (mediaId, path, objectid) VALUES (%L, %L, %L)",
    mediaid, file, blockId
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

exports.getMediaById = async (mediaid, conn = null) => {
  if (!conn)
    conn = pool;
  const res = await conn.query(pgformat(
    "SELECT * FROM media WHERE mediaId = %L", mediaid
  ));
  if (res.rows.length === 0)
    return null;
  return res.rows[0];
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

exports.getStreamObject = async (mediaid, objectid) => {
  return await objectCacheLock.acquire(mediaid, (callback) => {
    debug(`getStreamObject(${mediaid}, ${objectid})`);

    // check the cache 
    const cacheObject = objectCache.get(objectid);
    if (cacheObject)
      return callback(null, cacheObject);

    debug(`\tNOT CACHED :( fetching from backing store`);
    const object = mediaStore.getBlock(objectid).then((object) => {
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
