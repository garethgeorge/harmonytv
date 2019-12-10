const debug = require("debug")("web:api/user");
const model = require("../model");
const route = require("express").Router();

/*
  resume watching management routes 
*/
route.get("/createAuthToken", async (req, res) => {
  const duration = req.query.duration ? req.query.duration : "5m";
  res.end(await model.user.createAuthToken(req.user, duration));
});

route.post("/setPlaybackPosition", async (req, res) => {
  if (!req.body.position || !req.body.total_duration || !req.body.mediaid) {
    return res.end(
      JSON.stringify({
        error: "bad arguments, expected body.position && body.total_duration",
      })
    );
  }
  debug(
    "updated resume watching position for user: " + req.user.userid,
    req.body
  );

  await req.user.setPlaybackPositionForMedia(
    req.body.mediaid,
    Math.round(req.body.position),
    Math.round(req.body.total_duration)
  );
  return res.end(JSON.stringify(req.body));
});

route.post("/setMediaPlayed", async (req, res) => {
  if (!req.body.mediaid || !req.body.played) {
    res.end(
      JSON.stringify({
        error: "bad arguments, expected body.mediaid and body.played",
      })
    );
  }

  // body.played specifies whether the media has been played or not... pretty straightforward

  if (req.body.played) {
    await req.user.markMediaPlayed("" + req.body.mediaid);
  } else {
    await req.user.markMediaUnplayed("" + req.body.mediaid);
  }

  return res.end(
    JSON.stringify({
      mediaid: req.body.mediaid,
      played: req.body.played,
    })
  );
});

route.get("/listResumeWatching", async (req, res) => {
  return res.end(JSON.stringify(await req.user.listResumeWatching()));
});

// TODO: set password route

module.exports = route;
