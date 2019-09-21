const stream = require("stream");
const crypto = require("crypto");

function StreamStringWriter(callback) {
  let bufferedData = [];
  return new stream.Writable({
    write: function(chunk, encoding, next) {
      bufferedData.push(chunk)
      next();
    },
    final: function(cb) {
      cb();
      callback(bufferedData.join(''));
    }
  });
}

function StringStreamReadable(string) {
  const Readable = require('stream').Readable;
  const s = new Readable();
  s._read = () => {}; // redundant? see update below
  s.push(string);
  s.push(null);

  return s;
}

module.exports = {
  StreamStringWriter: StreamStringWriter,
  StringStreamReadable: StringStreamReadable,
};