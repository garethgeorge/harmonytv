const debug = require("debug")("web:api/lobby");
const model = require("../model");
const route = require('express').Router();
const lobby = require("../model/lobby");

route.get("/create", auth_required, (req, res) => {
  const lby = lobby.create()
  if (req.query.mediaid) {
    lby.startPlaying(req.query.mediaid);
  }
  
  res.header("Content-Type", "application/json");
  res.end(JSON.stringify({
    lobbyId: lby.id
  }));
});

module.exports = route;