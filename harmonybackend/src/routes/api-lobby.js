const debug = require("debug")("web:api/lobby");
const model = require("../model");
const route = require("express").Router();
const lobby = require("../model/lobby");

route.get("/create", auth_required, async (req, res) => {
  if (!req.query.mediaid)
    return req.end(
      JSON.stringify({
        error: "no mediaid specified"
      })
    );

  const mediainfo = await model.media.getMediaInfo("" + req.query.mediaid);
  if (!mediainfo) {
    return req.end(
      JSON.stringify({
        error: "media with mediaid '" + req.query.mediaid + '" does not exist.'
      })
    );
  }
  debug("creating lobby for media: %o", mediainfo);

  const resume = await req.user.getResumeWatchingForMedia(req.query.mediaid);

  debug("created lobby to play video: " + req.query.mediaid + " resume watching state: ", resume);
  const lby = lobby.create(mediainfo);
  lby.setSyncPosition(resume ? resume.position : 0);

  res.header("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      lobbyId: lby.id
    })
  );
});

route.post("/:lobbyid/setQueue", async (req, res) => {
  const lobby = lobby.get(req.params.lobbyid);
  if (!lobby) {
    res.status(404);
    return res.end(
      JSON.stringify({
        error: "lobby not found"
      })
    );
  }

  lobby.setVideoQueue(req.body);
  return res.end(JSON.stringify(req.body));
});

route.get("/:lobbyid/getQueue", async (req, res) => {
  const lobby = lobby.get(req.params.lobbyid);
  if (!lobby) {
    res.status(404);
    return res.end(
      JSON.stringify({
        error: "lobby not found"
      })
    );
  }

  return res.end(JSON.stringify(lobby.getVideoQueue()));
});

module.exports = route;
