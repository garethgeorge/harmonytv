const pgformat = require('pg-format');
const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
const pool = require("./db");

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

  async checkPassword(queryPassword) {
    return !!(this.passwordsha256) && hashPassword(queryPassword) === this.passwordsha256;
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

exports.getById = async (id) => {
  const user = new User(id);
  await user.load();
  return user;
}

exports.getByUsername = async (username) => {
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
