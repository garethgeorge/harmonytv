const pgformat = require('pg-format');
const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
const pool = require("./db");
const debug = require("debug")("model:user");

const hashPassword = (userid, password) => {
  return crypto.createHash('sha256').update(userid + password).digest("hex");
}

class User {
  constructor(userid, conn=null) {
    if (!conn)
      conn = pool;
    
    this.userid = userid;
  }

  async load(conn=null) {
    if (!conn)
      conn = pool;
    
    const res = await conn.query(pgformat("SELECT * FROM users WHERE userid = %L", this.userid));
    if (res.rows.length === 0) {
      throw new Error("fatal error: user with id: " + this.userid + " not found");
    }
    this.username = res.rows[0].username;
    this.passwordsha256 = res.rows[0].passwordsha256;
    return this;
  }

  checkPassword(queryPassword) {
    if (!this.passwordsha256)
      return ;
    const pwhash = hashPassword(this.userid, queryPassword);
    debug(`checkPassword() - compare hashes ${this.passwordsha256} === ${pwhash}`);
    return pwhash === this.passwordsha256;
  }

  toJSON() {
    return {
      userid: this.userid,
      username: this.username,
    }
  }

  async setPlaybackPositionForMedia(mediaid, position, total_duration, conn=null) {
    if (!conn)
      conn = pool;
    
    debug("setPlaybackPositionForMedia(", mediaid, position, total_duration, ")");
    await conn.query(pgformat(`
      INSERT INTO user_resume_watching (userid, mediaid, position, total_duration)
      VALUES (%L, %L, %L, %L)
      ON CONFLICT (userid, mediaid) DO UPDATE 
      SET position = %L, total_duration = %L
    `, this.userid, mediaid, position, total_duration, position, total_duration));
  }

  async listResumeWatching(conn = null) {
    if (!conn)
      conn = pool;
    const res = await conn.query(pgformat(`
      SELECT mediaid, position, total_duration FROM user_resume_watching WHERE userid = %L
    `, this.userid));
    return res.rows.map((row) => {
      return {
        mediaid: row.mediaid,
        position: parseInt(row.position), 
        total_duration: parseInt(row.total_duration),
      }
    });
  }

  async getResumeWatchingForMedia(mediaid, conn=null) {
    if (!conn)
      conn = pool;
    const res = await conn.query(pgformat(`
      SELECT position, total_duration FROM user_resume_watching WHERE userid = %L AND mediaid = %L
    `, this.userid, mediaid));
    if (res.rows.length === 0)
      return null;
    return res.rows.map((row) => {
      return {
        mediaid: row.mediaid,
        position: parseInt(row.position), 
        total_duration: parseInt(row.total_duration),
      }
    })[0];
  }
}

exports.create = async (username, password, conn=null) => {
  if (!conn)
    conn = pool;

  const userid = uuidv4();
  const hash = hashPassword(userid, password);
  console.log("password hash: " + hash);
  await conn.query(pgformat(
    "INSERT INTO users (userid, username, passwordsha256) VALUES (%L, %L, %L)",
    userid, username, hash 
  ));
  
  return await exports.getById(userid);
}

exports.getById = async (id, conn=null) => {
  if (!conn)
    conn = pool;
  const user = new User(id);
  await user.load(conn);
  return user;
}

exports.getByUsername = async (username, conn=null) => {
  if (!conn)
    conn = pool;
  const res = await conn.query(pgformat(
    "SELECT userid FROM users WHERE username = %L", username
  ));

  if (res.rows.length === 0) {
    return null;
  }

  const user = new User(res.rows[0].userid);
  await user.load();
  return user;
}
