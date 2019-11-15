const debug = require("debug")("web:api/media");
const model = require("../model");
const route = require("express").Router();

route.get("/:mediaid/info.json", async (req, res) => {
  debug("getting info for media: " + req.params.mediaid);
  const media = await model.media.getMediaInfo(req.params.mediaid);
  debug("\tmedia: " + JSON.stringify(media, false, 3));
  if (media === null) {
    res.status(404);
    res.end("404 Not Found");
  }
  res.status(200);
  debug("\tsuccessfully retrieved and returning.");
  res.end(JSON.stringify(media));
});

route.get("/:mediaid/files/:path", async (req, res) => {
  const mediaId = req.params.mediaid;
  const path = req.params.path;

  debug(`fetching media object ${mediaId} ${path}`);
  const mediaObjId = await model.media.mediaObjectIdByPath(mediaId, path);

  if (!mediaObjId) {
    debug("\tobject not found");
    res.status(404);
    res.end("404 Object Not Found");
    return;
  }

  debug("\tfound object, streaming back to requester");

  let range;
  if (req.headers.range) {
    let bytesPart = req.headers.range.substr(
      req.headers.range.indexOf("=") + 1
    );
    const segments = bytesPart.split("-");
    let startRange = parseInt(segments[0]);
    let stopRange = parseInt(segments[1]);
    range = {
      start: startRange,
      stop: stopRange
    };

    debug(
      "should try to only fetch range: ",
      range,
      " OPERATION NOT YET SUPPORTED"
    );
  }

  const obj = await model.media.getStreamObject(mediaId, mediaObjId);
  res.setHeader("Content-Type", obj.mimetype);
  obj.stream.pipe(res);
});

module.exports = route;
