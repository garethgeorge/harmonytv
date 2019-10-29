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
  constructor(drive, rootFolderId) {
    this.gapi = drive;
    this.rootFolderId = rootFolderId;
  }

  /* 
    block store api
  */
  getBlock(blockId, encryptionKey=null) {
    return new Promise((accept, reject) => {
      this.gapi.files.get({
        fileId: blockId,
        alt: 'media',
      }, {
        responseType: 'stream'
      }, (err, res) => {
        if (err)
          return reject(err);
        
        accept({
          stream: res.data,
          mimetype: res.headers["content-type"],
          length: parseInt(res.headers['content-length']),
        });
      });
    });
  }

  putBlock(srcPipe, mimetype) { // returns the block's id
    return new Promise((accept, reject) => {
      this.gapi.files.create({
        resource: {
          name: uuidv4(), // the name doesn't actually matter it should not be used to retrieve the file but can 
          parents: [this.rootFolderId],
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
  
  async *listAllBlocks() {
    let nextPageToken = null;
    do {
      const files = await new Promise((accept, reject) => {
        this.gapi.files.list({
          q: "'" + this.gdriveBlockFolderId + "' in parents and trashed = false",
          fields: 'nextPageToken, files(id, mimeType)',
          spaces: 'drive',
          pageSize: 512,
          pageToken: nextPageToken
        }, (err, res) => {
          if (err)
            return reject(err);

          nextPageToken = res.data.nextPageToken;
          accept(res.data.files);
        });
      });
      for (const file of files) {
        yield file;
      }
    } while (!!nextPageToken)
  }
  
  /*
    the below functions are google drive specific and are, therefore,
    not used in the application at the moment 
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

module.exports = async (rootFolderId) => {
  const oAuth2Client = await authenticate(credentials);
  const drive = google.drive({version: 'v3', auth: oAuth2Client});
  return new GDriveBlockStore(drive, rootFolderId);
}