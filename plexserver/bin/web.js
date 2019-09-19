(async () => {
  const express = require("express");
  const model = require("../src/model");
  const btoa = require("btoa");
  const bodyParser = require('body-parser');
  const app = express();
  // TODO: switch to using debug 

  await model.setup();

  app.use(require("morgan")("tiny"));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.use(express.static("./web"));

  /* required for use as an API backend */
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  });

  app.get("/api/getLibraries", async (req, res) => {
    const libraries = await model.getAllLibraries();
    res.header("Content-Type", "application/json");
    res.end(JSON.stringify(libraries));
  });

  app.get("/api/library/:libraryid/getMedia", async (req, res) => {
    // first get the library 
    const media = await model.libraryGetAllMedia(req.params.libraryid);
    console.log("returned " + media.length + " records for library " + req.params.libraryid);
    res.header("Content-Type", "application/json");
    res.end(JSON.stringify(media));
  });

  /*
    this route directly accesses the file from the backing store from streaming 
    w/o optimization
  */

  app.get("/media/:mediaid/info.json", async (req, res) => {
    console.log("getting info for media: " + req.params.mediaid);
    const media = await model.getMediaById(req.params.mediaid);
    console.log("\tmedia: " + JSON.stringify(media, false, 3));
    if (media === null) {
      res.status(404);
      res.end("404 Not Found");
    }
    res.status(200);
    console.log("\tsuccessfully retrieved and returning.");
    res.end(JSON.stringify(media));
  });

  app.get("/media/:mediaid/files/:path", async (req, res) => {
    const mediaId = req.params.mediaid;
    const path = req.params.path;

    console.log(`fetching media object ${mediaId} ${path}`);
    const mediaObjId = await model.getStreamObjectIdFromPath(mediaId, path);

    if (!mediaObjId) {
      console.log("\tobject not found");
      res.status(404);
      res.end("404 Object Not Found");
      return ;
    }

    console.log("\tfound object, streaming back to requester");

    let range;
    if (req.headers.range) {
      let bytesPart = req.headers.range.substr(req.headers.range.indexOf("=") + 1);
      const segments = bytesPart.split("-");
      let startRange = parseInt(segments[0]);
      let stopRange = parseInt(segments[1]);
      range = {
        start: startRange,
        stop: stopRange,
      }

      console.log("should try to only fetch range: ", range, " OPERATION NOT YET SUPPORTED");
    }

    const obj = await model.getStreamObject(mediaId, mediaObjId);
    res.setHeader("Content-Type", obj.mimetype);
    obj.stream.pipe(res);
  });

  app.listen(5000, () => {
    console.log("listening on port :5000");
  });

})();