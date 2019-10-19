const debug = require("debug")("web:api/user");
const model = require("../model");
const route = require('express').Router();

route.post("/setPlaybackPosition", async (req, res) => {
  if (!req.body.position || !req.body.total_duration || !req.body.mediaid) {
    return res.end(JSON.stringify({
      "error": "bad arguments, expected body.position && body.total_duration"
    }));
  }
  debug("updated resume watching position for user: " + req.user.userid, req.body);

  await req.user.setPlaybackPositionForMedia(req.body.mediaid, Math.round(req.body.position), Math.round(req.body.total_duration));
  return res.end(JSON.stringify(req.body));
});

route.get("/listResumeWatching", async (req, res) => {
  return res.end(JSON.stringify(await req.user.listResumeWatching()));
});

module.exports = route;