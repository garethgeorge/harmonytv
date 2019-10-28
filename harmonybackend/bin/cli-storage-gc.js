const crypto = require("crypto");
const fs = require("fs");
const model = require("../src/model");
const process = require("process");
const async = require("async");

(async () => {
  await model.setup();

  let count = 0;

  const queue = async.queue((file, callback) => {
    model.mediaStore.rmBlock
  });

  for await (let blockInfo of model.mediaStore.listAllBlocks()) {
    const blockid = blockInfo.id;
    const res = await model.media.objectGetParentMedia(blockInfo.id);
    console.log(blockid + ":", res);
    if (!res) {
      await model.mediaStore.rmBlock(blockid);
      console.log("\tremoved block");
    }
  }
})();