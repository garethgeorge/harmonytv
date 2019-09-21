(async () => {
  const app = require("express")();
  const http = require('http').createServer(app);
  const io = require("socket.io")(http);
  const debug = require("debug")("web");

  const model = require("../src/model");
  const lobby = require("../src/lobby");


  await model.setup();

  app.use(require("morgan")("tiny"));
  app.use(require('body-parser').urlencoded({ extended: false }));
  app.use(require('body-parser').json());

  /* required for use as an API backend */
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  });

  app.get("/library/getAll", async (req, res) => {
    const libraries = await model.getAllLibraries();
    res.header("Content-Type", "application/json");
    res.end(JSON.stringify(libraries));
  });

  app.get("/library/:libraryid/getMedia", async (req, res) => {
    // first get the library 
    const media = await model.libraryGetAllMedia(req.params.libraryid);
    debug("returned " + media.length + " records for library " + req.params.libraryid);
    res.header("Content-Type", "application/json");
    res.end(JSON.stringify(media));
  });

  app.get("/media/:mediaid/info.json", async (req, res) => {
    debug("getting info for media: " + req.params.mediaid);
    const media = await model.getMediaById(req.params.mediaid);
    debug("\tmedia: " + JSON.stringify(media, false, 3));
    if (media === null) {
      res.status(404);
      res.end("404 Not Found");
    }
    res.status(200);
    debug("\tsuccessfully retrieved and returning.");
    res.end(JSON.stringify(media));
  });

  app.get("/media/:mediaid/files/:path", async (req, res) => {
    const mediaId = req.params.mediaid;
    const path = req.params.path;

    debug(`fetching media object ${mediaId} ${path}`);
    const mediaObjId = await model.getStreamObjectIdFromPath(mediaId, path);

    if (!mediaObjId) {
      debug("\tobject not found");
      res.status(404);
      res.end("404 Object Not Found");
      return ;
    }

    debug("\tfound object, streaming back to requester");

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

      debug("should try to only fetch range: ", range, " OPERATION NOT YET SUPPORTED");
    }

    const obj = await model.getStreamObject(mediaId, mediaObjId);
    res.setHeader("Content-Type", obj.mimetype);
    obj.stream.pipe(res);
  });
  
  app.get("/lobby/create", (req, res) => {
    const lby = lobby.create()
    if (req.query.mediaid) {
      lby.startPlaying(req.query.mediaid);
    }
    
    res.header("Content-Type", "application/json");
    res.end(JSON.stringify({
      lobbyId: lby.id
    }));
  });


  lobby.socketio_setup(io.of("/lobbyns"));

  http.listen(5000, () => {
    console.log("listening on port :5000");
  });

})();