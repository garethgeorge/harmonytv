const debug = require("debug")("web");
const passport = require('passport');
const PassportLocalStrategy = require('passport-local').Strategy;
const app = require("express")();
const http = require('http').createServer(app);
const io = require("socket.io")(http);

const model = require("../src/model");
const lobby = require("../src/model/lobby");

app.use(require("morgan")("tiny"));
app.use(require('body-parser').urlencoded({ extended: false }));
app.use(require('body-parser').json());

app.use(require('express-session')({ secret: 'AnVjaVMfpAIvfpeZfp', resave: false, saveUninitialized: false }))
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});


// TODO: finish implementing the passport strategy
passport.use(new PassportLocalStrategy(
  (username, password, cb) => {
    debug("authenticating user: " + username + " pass: " + password);
    (async () => {
      try {
        const user = await model.user.getByUsername(username);
        debug("found user: ", user);
        if (!user)
          return cb(null, false);

        if (user.checkPassword(password)) {
          debug("successful password check for user " + username);
          return cb(null, user);
        } else {
          debug("failed password check for user " + username);
          return cb(null, false);
        }
      } catch (e) {
        debug("encountered error: " + e);
        return cb(e);
      }
    })();
  }));

// TODO: finish passport.serializeUser and passport.deserializeUser from https://github.com/passport/express-4.x-local-example/blob/master/server.js
passport.serializeUser((user, cb) => {
  cb(null, user.userid);
});

passport.deserializeUser((id, cb) => {
  model.user.getById(id)
    .then((user) => {
      cb(null, user);
    }).catch((err) => {
      cb(err, null);
    });
});

app.use('/api', require("../src/routes/api"));

(async () => {
  await model.setup();

  lobby.socketio_setup(io.of("/lobbyns"));

  http.listen(5000, () => {
    console.log("listening on port :5000");
  });
})();