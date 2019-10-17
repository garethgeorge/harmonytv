const debug = require("debug")("web:api/library");
const model = require("../model");
const route = require('express').Router();

route.get("/getAll", async (req, res) => {
  const libraries = await model.getAllLibraries();
  res.header("Content-Type", "application/json");
  res.end(JSON.stringify(libraries));
});

route.get("/:libraryid/getMedia", async (req, res) => {
  // first get the library 
  const media = await model.libraryGetAllMedia(req.params.libraryid);
  debug("returned " + media.length + " records for library " + req.params.libraryid);
  res.header("Content-Type", "application/json");
  res.end(JSON.stringify(media));
});

module.exports = route;