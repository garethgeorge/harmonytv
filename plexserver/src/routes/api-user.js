const debug = require("debug")("web:api/user");
const model = require("../model");
const route = require('express').Router();

route.post("/set-playback-position", (req, res) => {
  // sets the user's playback position for the media file :P
})

module.exports = route;