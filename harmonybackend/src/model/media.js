const pgformat = require('pg-format');
const pool = require("./db");
const debug = require("debug")("model:media");

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

module.exports.getStreamObject