const pgformat = require("pg-format");
const config = require("../config");
const debug = require("debug")("model");
const process = require("process");
const fs = require("fs");
const { migrate } = require("postgres-migrations");

const pool = require("./db");

let mediaStore = null;

exports.pool = pool;
exports.user = require("./user");
exports.media = require("./media");

exports.setup = async (conn = null) => {
  for (const module of [exports.pool, exports.user, exports.media]) {
    if (module.setup) {
      await module.setup();
    }
  }

  mediaStore = exports.media.storageBackend;

  debug("initializing database and running migrations");
  await migrate(config.pg, "./src/db-migrations/", {
    logger: require("debug")("model:migrate")
  });
};

exports.shutdown = () => {
  pool.end();
  setImmediate(() => {
    process.exit(0);
  });
};

// direct access to a client can be needed for supporting transactional insertions
exports.getClient = async () => {
  return await pool.connect();
};

/*
  misc methods that haven't been factored into their own library yet
*/
exports.getLibraryByName = async (libraryName, conn = null) => {
  if (!conn) conn = pool;
  const res = await conn.query(
    pgformat("SELECT * FROM libraries WHERE libraryName = %L", libraryName)
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
};

exports.getAllLibraries = async (conn = null) => {
  if (!conn) conn = pool;
  const res = await conn.query("SELECT * FROM libraries");
  return res.rows;
};

exports.libraryGetAllMedia = async (libraryId, conn = null) => {
  if (!conn) conn = pool;

  const res = await conn.query(pgformat("SELECT * FROM media WHERE libraryId = %L", libraryId));
  return res.rows;
};
