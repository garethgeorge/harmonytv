const path = require("path");
const mkdirpsync = require("mkdirpsync");
const process = require("process");
const AWS = require("aws-sdk");

const resolvePath = (filepath) => {
  if (filepath[0] == "~") {
    filepath = path.join(process.env.HOME, filepath.slice(1));
  }
  mkdirpsync(path.dirname(filepath));
  return filepath;
};

module.exports = {
  secret: "a good secret for session authentication",

  inMemoryObjectCacheDuration: 3600, // duration in seconds
  inMemoryObjectCacheSize: 32 * 1024 * 1024,

  urlForMediaObject: (mediaid, path) => {
    return path;
  },
  /*
  // if you are using a CDN like BunnyCDN
  urlForMediaObject: (mediaid, path) => {
    return (
      "https://<your pull zone>.b-cdn.net/api/media/" + mediaid + "/files/" + path
    );
  },
  */

  // gets combined with object id's to generate unique encryption keys for
  // media objects and other files, changing this will corrupt all stored data
  pg: {
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    database: process.env.POSTGRES_DB || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    ssl: (process.env.POSTGRES_SSL || "false") === "true",
  },

  gdrive: {
    encryptionKey: "<your encryption key here>", // a key to use for encryption :P
    parentFolder: "<your gdrive folder id>",
    scopes: ["https://www.googleapis.com/auth/drive"],
    tokenPath: resolvePath("~/.config/myplex/gdrive-token.json"), // TODO: update this to an application specific path instead of sharing w/plexfs
    credentials: {
      /* Your credentials here */
    },
  },

  // options not currently used
  s3: {
    bucket: "myplex-movies",
    endpoint: "s3.wasabisys.com",
    urlBase: "https://s3.us-west-1.wasabisys.com/",
    credentials: new AWS.SharedIniFileCredentials({ profile: "wasabi" }),
  },
};
