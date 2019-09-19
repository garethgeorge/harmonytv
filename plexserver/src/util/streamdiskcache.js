var Util   = require('util');
var Stream = require('stream').Stream;
const rimraf = require('rimraf');
const path = require("path");
const os = require("os");
const fs = require("fs");

const tmpDir = path.join(os.tmpdir(), "/plex_cache/");
rimraf.sync(tmpDir);
mkdirpsync(tmpDir);
console.log("streamcache directory: " + tmpDir);

module.exports = StreamCache;
Util.inherits(StreamCache, Stream);
function StreamCache() {
  Stream.call(this);

  this.writable = true;
  this.readable = true;

  this._buffers = [];
  this._dests   = [];
  this._ended   = false;
}

StreamCache.prototype.write = function(buffer) {
  this._buffers.push(buffer);

  this._dests.forEach(function(dest) {
    dest.write(buffer);
  });

  // if we exceed 32 megabytes
  if (this.getLength() > 32 * 1000 * 1000 && !this.flushingToDisk) {
    console.log("\tcaching streamcache buffers on disk");
    const buffers = this._buffers.slice(0);
    const bytes = Buffer.concat(buffers);
    console.log("\tflushing out " + bytes.legnth + " bytes.");
    this.flushingToDisk = true;
  }
};

StreamCache.prototype.pipe = function(dest, options) {
  if (options) {
    throw Error('StreamCache#pipe: options are not supported yet.');
  }

  this._buffers.forEach(function(buffer) {
    dest.write(buffer);
  });

  if (this._ended) {
    dest.end();
    return dest;
  }

  this._dests.push(dest);

  return dest;
};

StreamCache.prototype.getLength = function() {
  return this._buffers.reduce(function(totalLength, buffer) {
    return totalLength + buffer.length;
  }, 0);
};

StreamCache.prototype.end = function() {
  this._dests.forEach(function(dest) {
    dest.end();
  });

  this._ended = true;
  this._dests = [];
};