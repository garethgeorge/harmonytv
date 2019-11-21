const debug = require("debug")("web:api/lobby");
const model = require("../model");
const route = require("express").Router();
const lobby = require("../model/lobby");
const uuidv4 = require("uuid/v4");
const util = require("../util");

route.get("/create", auth_required, async (req, res) => {
  // check required parameters
  if (!req.query.mediaid)
    return req.end(
      JSON.stringify({
        error: "no mediaid specified"
      })
    );

  // load the media info
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

  debug(
    `created lobby to play video %o resume watching state %o`,
    req.query.mediaid,
    resume
  );
  const lby = lobby.create(mediainfo);
  lby.setSyncPosition(resume ? resume.position : 0);

  if (mediainfo.seriesname) {
    const remainingEpisodes = (
      await model.media.seriesGetEpisodes(mediainfo.seriesname)
    ).filter(episode => {
      if (episode.seasonnumber < mediainfo.seasonnumber) return false;
      if (
        episode.seasonnumber === mediainfo.seasonnumber &&
        episode.episodenumber <= mediainfo.episodenumber
      )
        return false;
      // consider the episode to be completed
      if (episode.completed_fraction && episode.completed_fraction > 0.9)
        return false;
      return true;
    });
    debug("remaining episodes after filtering: %o", remainingEpisodes);

    remainingEpisodes.sort((a, b) => {
      return util.lexographic_comparator(
        [a.seasonnumber, a.episodenumber],
        [b.seasonnumber, b.episodenumber]
      );
    });

    const queue = [req.query.mediaid];
    for (const ep of remainingEpisodes) {
      queue.push(ep.mediaid);
    }

    lby.setVideoQueue({
      queueId: uuidv4(),
      videos: queue
    });
  }

  res.header("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      lobbyId: lby.id
    })
  );
});

route.post("/:lobbyid/setQueue", async (req, res) => {
  const lby = lobby.get(req.params.lobbyid);
  if (!lby) {
    res.status(404);
    return res.end(
      JSON.stringify({
        error: "lobby not found"
      })
    );
  }

  lby.setVideoQueue(req.body);
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
