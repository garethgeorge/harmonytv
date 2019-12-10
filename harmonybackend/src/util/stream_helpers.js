const stream = require("stream");
const crypto = require("crypto");

function StreamStringWriter(callback) {
  let bufferedData = [];
  return new stream.Writable({
    write: function(chunk, encoding, next) {
      bufferedData.push(chunk);
      next();
    },
    final: function(cb) {
      cb();
      callback(bufferedData.join(""));
    },
  });
}

function StringStreamReadable(string) {
  const Readable = require("stream").Readable;
  const s = new Readable();
  s._read = () => {}; // redundant? see update below
  s.push(string);
  s.push(null);

  return s;
}

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  if (chunks[0] instanceof Buffer) {
    return Buffer.concat(chunks);
  } else return chunks.join("");
};

module.exports = {
  StreamStringWriter: StreamStringWriter,
  StringStreamReadable: StringStreamReadable,
  streamToBuffer: streamToBuffer,
};
