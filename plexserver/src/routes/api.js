const debug = require("debug")("web:api");
const model = require("../model");
const passport = require('passport');
const route = require('express').Router();

auth_required = (req, res, next) => {
  if (!req.user) {
    return res.end(JSON.stringify({error: "Not authenticated"}));
  }
  next();
}

route.post('/login',
  passport.authenticate('local', { successRedirect: '/api/user/',
                                  failureRedirect: '/api/user/',
                                  failureFlash: false })
);

route.use("/library/", auth_required, require("./api-library"));
route.use("/media/", auth_required, require("./api-media"));
route.use("/lobby/", auth_required, require("./api-lobby"));

route.get("/user/", (req, res) => {
  const resp = {
    user: (req.user ? req.user.toJSON() : null)
  }

  debug("request to /user/ returning current user: " + JSON.stringify(resp));
  res.end(JSON.stringify(resp));
});
route.use("/user/", auth_required, require("./api-user"));

module.exports = route;