const crypto = require("crypto");
const fs = require("fs");
const model = require("../src/model");
const process = require("process");
const async = require("async");

(async () => {
  await model.setup();

  const queue = async.queue((blockid, callback) => {
    model.mediaStore.rmBlock(blockid)
      .then(() => {
        console.log("\tremoved blockid: " + blockid);
        callback()
      })
      .catch((e) => {
        console.error("error on removing block: " + blockid + " e: " + e);
        callback();
      });
  }, 4);

  for await (let blockInfo of model.mediaStore.listAllBlocks()) {
    const blockid = blockInfo.id;
    const res = await model.media.objectGetParentMedia(blockInfo.id);
    console.log(blockid + ":", res);
    
    if (res === null) {
      queue.push(blockid);
    }

    if (queue.length() > 128) {
      await queue.drain();
    }
  }
})();