const crypto = require("crypto");
const fs = require("fs");
const model = require("../src/model");
const process = require("process");

(async () => {
  await model.setup();

  console.log("uploading a file");
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  // const encryptionKey = null;
  const blockId = await model.mediaStore.putBlock(fs.createReadStream("./README.md"), null, encryptionKey);
  console.log("downloading that same file");
  const res = await model.mediaStore.getBlock(blockId, encryptionKey);
  res.stream.pipe(process.stdout);
})();