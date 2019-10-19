const debug = require("debug")("web:api/lobby");
const model = require("../model");
const route = require('express').Router();
const lobby = require("../model/lobby");

route.get("/create", auth_required, async (req, res) => {
  if (!req.query.mediaid)
    return req.end(JSON.stringify({
      error: "no mediaid specified"
    }));
  const lby = lobby.create()

  const resume = await req.user.getResumeWatchingForMedia(req.query.mediaid)
  debug("created lobby to play video: " + req.query.mediaid + " resume watching state: ", resume);
  lby.startPlaying(req.query.mediaid, resume ? resume.position : 0);
  
  res.header("Content-Type", "application/json");
  res.end(JSON.stringify({
    lobbyId: lby.id
  }));
});

module.exports = route;