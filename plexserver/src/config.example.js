const path = require('path');
const mkdirpsync = require('mkdirpsync');
const process = require('process');
const AWS = require("aws-sdk");

const resolvePath = (filepath) => {
  if (filepath[0] == '~') {
    filepath = path.join(process.env.HOME, filepath.slice(1));
  }
  mkdirpsync(path.dirname(filepath));
  return filepath;
}

module.exports = {
  inMemoryObjectCacheSize: 4000 * 1000 * 1000, // 1 GB in bytes
  inMemoryObjectCacheDuration: 3600, // keep it for an hour

  // gets combined with object id's to generate unique encryption keys for 
  // media objects and other files, changing this will corrupt all stored data
  pg: {
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'postgres',
    port: 5432,
    ssl: false,
  },
  
  gdrive: {
    encryptionKey: "<your encryption key here>", // a key to use for encryption :P
    parentFolder: "<your gdrive folder id>",
    scopes: ['https://www.googleapis.com/auth/drive'],
    tokenPath: resolvePath("~/.config/myplex/gdrive-token.json"), // TODO: update this to an application specific path instead of sharing w/plexfs 
    credentials: {"installed":{"client_id":"655291428817-nu0odqirkicunj07nnskoocunrtqtkkf.apps.googleusercontent.com","project_id":"linen-diorama-169422","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"iEJdnuFi9iDxukQbChj7XLit","redirect_uris":["urn:ietf:wg:oauth:2.0:oob","http://localhost"]}},
  },

  // options not currently used
  s3: {
    bucket: "myplex-movies",
    endpoint: 's3.wasabisys.com',
    urlBase: 'https://s3.us-west-1.wasabisys.com/',
    credentials: new AWS.SharedIniFileCredentials({profile: 'wasabi'}),
  },
}