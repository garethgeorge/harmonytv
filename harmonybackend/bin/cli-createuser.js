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
  'username',
  {
    help: 'the name of the user to create',
  }
);

parser.addArgument(
  'password',
  {
    help: 'the password for the created user',
  }
);

const args = parser.parseArgs();

(async () => {
  await model.setup();
  const client = await model.getClient();

  try {
    const user = await model.user.create(args.username, args.password)
    console.log("created user " + user.userid);
  } finally {
    client.release();
    model.shutdown();
    console.log(require("wtfnode").dump());
  }
})();
