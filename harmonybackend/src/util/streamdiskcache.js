const fs = require("fs");

class StreamDiskCache {
  constructor(datasource, size) {
    this.size = size;
    fs.createWriteStream("show a disk file");
  }

  streamRange(startByte, endByte) {
    return new ReadableStream();
  }
}
