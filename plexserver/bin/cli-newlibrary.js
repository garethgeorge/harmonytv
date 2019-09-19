const ArgumentParser = require('argparse').ArgumentParser;
const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const model = require('../src/model');
const pgformat = require('pg-format');

parser = new ArgumentParser({
  help: true, 
  description: "command line tool for uploading a video to plex"
});

parser.addArgument(
  'libraryName',
  {
    help: 'the name of the library it belongs to',
  }
);

parser.addArgument(
  'libraryType',
  {
    help: 'the name of the show being uploaded',
  }
);

const args = parser.parseArgs();

(async () => {
  await model.setup();
  const client = await model.getClient();

  try {
    await client.query(pgformat(`
      INSERT INTO libraries (libraryId, libraryName, libraryType) VALUES (%L, %L, %L)
    `, uuidv4(), args.libraryName, args.libraryType));
  } finally {
    client.release();
    model.shutdown();
  }
})();