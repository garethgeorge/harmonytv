const path = require("path");
const AWS = require("aws-sdk");
const uuidv4 = require("uuid/v4");
const config = require("../config");
const crypto = require("crypto");

AWS.config.credentials = config.s3.credentials;

class S3Backend {
  constructor() {
    const ep = new AWS.Endpoint(config.s3.endpoint);
    const s3 = new AWS.S3({ endpoint: ep });

    // const credentials = new AWS.SharedIniFileCredentials({profile: 'wasabi'});
    // AWS.config.credentials = credentials;
    // const ep = new AWS.Endpoint('s3.wasabisys.com');
    // const s3 = new AWS.S3({endpoint: ep});
    this.s3 = s3;
  }

  // TODO: check if the block already exists, if it does skip uploading
  putBlock(srcPipe, mimetype = undefined) {
    // returns the block's id
    console.log("s3 trying to put block");
    return new Promise((accept, reject) => {
      const datums = [];
      const hash = crypto.createHash("sha1");

      srcPipe.on("error", reject);
      srcPipe.on("data", data => {
        hash.update(data);
        datums.push(data);
      });

      srcPipe.on("end", () => {
        const data = datums.join("");
        const objectId = hash.digest("hex");
        console.log(
          `s3 collected all of the data, length: ${data.length}, objectId: ${objectId} key: ${config.cacheEncryptionKey}`
        );

        this.s3.upload(
          {
            Bucket: config.s3.bucket,
            Body: Buffer.from(data, "binary"),
            Key: "blocks/" + objectId,
            ContentType: mimetype,
            // "SSECustomerAlgorithm": "AES256",
            // "SSECustomerKey": config.cacheEncryptionKey,
            ACL: "public-read"
          },
          (err, res) => {
            if (err) return reject(err);
            accept(objectId);
          }
        );
      });
    });
  }

  async getBlock(objectId, encryptionKey = null) {
    s3.getObject({
      Bucket: config.s3.bucket,
      Key: "blocks/" + objectId
      // SSECustomerAlgorithm: 'AES256',
      // SSECustomerKey: config.cacheEncryptionKey,
    }).createReadStream();
  }

  async getBlockUrl(objectId) {
    return config.s3.urlBase + config.s3.bucket + "/blocks/" + objectId;
  }

  // TODO: support named blocks
}

module.exports = async () => {
  return new S3Backend();
};
