const fs = require("fs");
const path = require("path");

const scanFiles = (dir, results) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullpath = path.join(dir, file);
    if (fs.lstatSync(fullpath).isDirectory()) {
      scanFiles(fullpath, results);
    } else {
      results.push(fullpath);
    }
  }
};

module.exports = {
  dirtree: dir => {
    const results = [];
    scanFiles(dir, results);
    return results;
  }
};
