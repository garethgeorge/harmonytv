const { Pool, Client } = require("pg");
const config = require("../config");
const pool = new Pool(config.pg);
module.exports = pool;
