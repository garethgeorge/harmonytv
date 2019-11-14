const crypto = require("crypto");
const fs = require("fs");
const model = require("../src/model");
const process = require("process");
const async = require("async");
const uuidv4 = require('uuid/v4');

(async () => {
  const mediaid = uuidv4();
  await model.setup();
  await model.media.putStreamObject(mediaid, "./bin/", "cli-test-put-stream-object.js");
})();