const crypto = require("crypto");
const debug = require("debug")("storage-backend:crypt");

/*
  encryption iv is hard coded -- this is fine b/c we use a unique encryption key
  for each file
*/
const cryptIv = Buffer.from([
  216,
  136,
  140,
  214,
  185,
  212,
  139,
  199,
  47,
  99,
  229,
  205,
  22,
  50,
  75,
  230
]);

class CryptBackend {
  constructor(base) {
    this.base = base;
  }

  listAllBlocks() {
    debug("CryptBackend:listAllBlocks() -- listing all blocks");
    return this.base.listAllBlocks();
  }

  rmBlock(blockId) {
    return this.base.rmBlock(blockId);
  }

  putBlock(srcPipe, mimetype, encryptionKey) {
    const keyBytes = crypto
      .createHash("sha256")
      .update(encryptionKey)
      .digest()
      .slice(0, 32);

    const encryptedPipe = crypto.createCipheriv(
      "aes-256-ctr",
      keyBytes,
      cryptIv
    );
    srcPipe.pipe(encryptedPipe);

    return this.base.putBlock(encryptedPipe, mimetype);
  }

  async getBlock(blockId, encryptionKey) {
    const keyBytes = crypto
      .createHash("sha256")
      .update(encryptionKey)
      .digest()
      .slice(0, 32);

    const res = await this.base.getBlock(blockId, encryptionKey);

    const decryptPipe = crypto.createDecipheriv(
      "aes-256-ctr",
      keyBytes,
      cryptIv
    );
    res.stream.pipe(decryptPipe);
    res.stream = decryptPipe;

    return res;
  }
}

module.exports = async backend => {
  return new CryptBackend(backend);
};
