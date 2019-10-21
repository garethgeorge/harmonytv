const config = require("../config");
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const util = require('util');
const uuidv4 = require('uuid/v4');
const _ = require("lodash");
const crypto = require('crypto');

const {StreamStringWriter, StringStreamReadable} = require("../util/stream_helpers");

const SCOPES = config.gdrive.scopes;
const TOKEN_PATH = config.gdrive.tokenPath;
const credentials = config.gdrive.credentials;

// iv used for encryption, this is just a hard coded initialization vector
// the client provided key is where the real security comes from 
const cryptIv = Buffer.from([
  216, 136, 140, 214, 
  185, 212, 139, 199, 
  47, 99, 229, 205, 
  22, 50, 75, 230, 
]);
const cryptKey = crypto.createHash('sha256').update(config.gdrive.encryptionKey).digest().slice(0, 32);

async function authenticate(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);
  
  oAuth2Client.setCredentials(await getAuthenticationToken(credentials));

  return oAuth2Client;
}

async function getAuthenticationToken(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  try {
    // return the access token
    return JSON.parse(fs.readFileSync(TOKEN_PATH).toString("ascii"));
  } catch (e) {
    // get an access token

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    // get the code
    const code = await new Promise((accept, reject) => {
      rl.question("Enter the code from that page here: ", accept);
    });
    rl.close();

    // get the token
    const token = await (util.promisify(oAuth2Client.getToken.bind(oAuth2Client))(code));
    oAuth2Client.setCredentials(token);

    // save the token
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    console.log("Token saved to " + TOKEN_PATH);
    return token;
  }
}

// NOTE: this is all legacy code from plexfs
class GDriveBlockStore {
  constructor(drive) {
    this.gapi = drive;
    this.gdriveRootFolderId = null; // the ID of the top level folder below which all data is stored
    this.gdriveManifestFiles = {}; // cache of the file name / id mappings of objects in the top level folder
  }

  async setGdriveRootFolderId(gdriveRootFolderId) {
    console.log("setting google drive root folder to: " + gdriveRootFolderId);

    let nextPageToken = null;
    
    this.gdriveRootFolderId = gdriveRootFolderId;
    this.gdriveManifestFiles = await this.getFilesInFolder(gdriveRootFolderId);

    if (this.gdriveManifestFiles["blocks"] == undefined) {
      this.gdriveBlockFolderId = await this.createFolderInFolder(this.gdriveRootFolderId, "blocks");
      this.gdriveManifestFiles = await this.getFilesInFolder(gdriveRootFolderId);
    } else {
      this.gdriveBlockFolderId = this.gdriveManifestFiles["blocks"].id;
    }

    console.log("BLOCK FOLDER ID: " + this.gdriveBlockFolderId);
    console.log("MANIFEST FILES: ", Object.values(this.gdriveManifestFiles).map((obj) => obj.name).join(", "));
  }

  /* 
    block store api
  */
  getBlock(blockId, encryptionKey=null) {
    if (encryptionKey == null) {
      encryptionKey = cryptKey;
    } else 
      encryptionKey = crypto.createHash('sha256').update(encryptionKey).digest().slice(0, 32);

    return new Promise((accept, reject) => {
      this.gapi.files.get({
        fileId: blockId,
        alt: 'media',
      }, {
        responseType: 'stream'
      }, (err, res) => {
        if (err) {
          return reject(err);
        }
        // decrypt the block and return it 
        const resultStream = crypto.createDecipheriv('aes-256-ctr', encryptionKey, cryptIv);
        res.data.pipe(resultStream);

        accept({
          stream: resultStream,
          mimetype: res.headers["content-type"],
          length: parseInt(res.headers['content-length']),
        });
      });
    });
  }

  putBlock(srcPipe, mimetype=null, encryptionKey=null) { // returns the block's id
    // encrypt the block 
    if (encryptionKey == null) {
      encryptionKey = cryptKey;
    } else 
      encryptionKey = crypto.createHash('sha256').update(encryptionKey).digest().slice(0, 32);

    const sourceStream = crypto.createCipheriv('aes-256-ctr', encryptionKey, cryptIv);
    srcPipe.pipe(sourceStream);

    return new Promise((accept, reject) => {
      this.gapi.files.create({
        resource: {
          name: uuidv4(), // the name doesn't actually matter it should not be used to retrieve the file but can 
          parents: [this.gdriveBlockFolderId],
          mimeType: mimetype || "application/octet-stream",
        },
        media: {
          body: sourceStream
        },
        fields: 'id',
      }, function(err, res) {
        if (err)
          return reject(err);
        accept(res.data.id);
      });
    });
  }

  rmBlock(blockId) {
    return new Promise((accept, reject) => {
      this.gapi.files.delete({
        'fileId': blockId,
      }, function(err) {
        if (err) return reject(err);
        accept(null);
      });
    });
  }
  
  putManifest(key, contents) {
    return this.putNamedFileStream(key, StringStreamReadable(contents));
  }
  
  putManifestStream(key, stream) {
    // encrypt the block 
    const cryptStream = crypto.createCipheriv('aes-256-ctr', cryptKey, cryptIv);
    stream.pipe(cryptStream);
    stream = cryptStream;

    return new Promise((accept, reject) => {
      const callback = (err, res) => {
        if (err)
          return reject(err);

        // update the root folder object mapping 
        this.gdriveManifestFiles[key] = {
          id: res.data.id,
          name: key,
        };

        accept(res.data.id);
      };

      // NOTE: if it already exists we should update it instead
      if (!!(this.gdriveManifestFiles[key])) {
        this.gapi.files.update({
          fileId: this.gdriveManifestFiles[key].id,
          media: {
            body: stream
          },
          fields: 'id',
        }, callback);
      } else {
        this.gapi.files.create({
          resource: {
            name: key, // the name doesn't actually matter as it should not be used to retrieve the file but can be
            parents: [this.gdriveRootFolderId],
            mimeType: "application/octet-stream",
          },
          media: {
            body: stream
          },
          fields: 'id',
        }, callback);
      }
    });
  }

  // returns a string 
  getManifest(key, contents) {
    if (!this.gdriveManifestFiles[key]) {
      const error = new Error("file not found '" + key + "'");
      error.code = 404;
      throw error;
    }

    return new Promise((accept, reject) => {
      this.gapi.files.get({
        fileId: this.gdriveManifestFiles[key].id,
        alt: 'media',
      }, {
        responseType: 'stream'
      }, (err, res) => {
        if (err)
          return reject(err);

        // decrypt the stream
        const resultStream = crypto.createDecipheriv('aes-256-ctr', cryptKey, cryptIv);
        res.data.pipe(resultStream);
        res.data = resultStream;

        // pipe it to a string 
        res.data.on('end', function () {
          accept(null);
        })
        .on('error', function (err) {
          reject(err);
        })
          .pipe()
          .pipe(StreamStringWriter(accept));
      });
    });
  }

  /*
    helpers 
  */
  async getMetadata(id, fields=null) {
    if (fields === null) 
      fields = "*";
    return new Promise((accept, reject) => {
      this.gapi.files.get({
        "fileId": id,
        "fields": fields
      }, (err, res) => {
        if (err)
          return reject(err);
        accept(res.data);
      });
    });
  }

  async getFilesInFolder(id) {
    // find the manifests in this directory :P 
    let nextPageToken = null;
    const directoryContents = {};
    
    do {
      await new Promise((accept, reject) => {
        this.gapi.files.list({
          q: "'" + id + "' in parents and trashed = false",
          fields: 'nextPageToken, files(id, name, mimeType)',
          spaces: 'drive',
          pageToken: nextPageToken
        }, (err, res) => {
          if (err)
            return reject(err);
          
          for (const file of res.data.files) {
            directoryContents[file.name] = file;
          }
          
          nextPageToken = res.nextPageToken;
          accept();
        });
      });
    } while (!!nextPageToken)

    return directoryContents;
  }

  async createFolderInFolder(parentId, name) {
    return await new Promise((accept, reject) => {
      this.gapi.files.create({
        resource: {
          name: name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }
      }, (err, file) => {
        if (err)  
          return reject(err);
        accept(file.id);
      });
    });
  }
};

module.exports = async () => {
  const oAuth2Client = await authenticate(credentials);
  const drive = google.drive({version: 'v3', auth: oAuth2Client});
  return new GDriveBlockStore(drive);
}