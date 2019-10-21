const uuidv4 = require("uuid/v4");
const debug = require("debug")("model:lobby");

let ionsp = null;

const lobbies = {};

class Lobby {
  constructor(media) {
    this.media = media;

    this.id = uuidv4();
    this.createdTime = (new Date).getTime(); 
    this.members = 0;

    // set the initial playing time
    this.nowPlaying = {
      updateTime: (new Date).getTime(), // the time at which it was updated 
      position: 0, // the position when it was updated 
      mediaid: this.media.mediaid, // the media id playing 
      state: "playing", // the state (can also be paused)
    };
  }

  getAge() {
    return (new Date).getTime() - this.createdTime;
  }
  
  setPlaybackPosition(position) {
    // broadcast the now playing position
    const copy = Object.assign({}, this.nowPlaying);
    copy.position = position;
    this.setNowPlaying(copy);
  }

  setNowPlaying(nowPlaying, socket=null) {
    this.nowPlaying = nowPlaying;
    if (socket) {
      socket.to(this.id).emit("server:update-now-playing", this.nowPlaying);
    } else {
      ionsp.in(this.id).emit("server:update-now-playing", this.nowPlaying);
    }
  }
};

// sweep old lobbies 
setInterval(() => {
  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];

    if (lobby.getAge() > 8 * 3600 * 1000 && lobby.members === 0) {
      delete lobbies[lobbyId];
    }
  }
}, 30 * 1000);

module.exports = {
  create: (media) => {
    if (!media)
      throw new Error("required media to be valid");

    const lobby = new Lobby(media);
    lobbies[lobby.id] = lobby;
    return lobby;
  },

  get: (id) => {
    return lobbies[id] || null;
  },

  socketio_setup: (_ionsp) => {
    ionsp = _ionsp;

    setInterval(() => {
      ionsp.emit("server:curtime", (new Date).getTime());
    }, 30000);

    ionsp.on("connection", (socket) => {
      debug("socket.io /lobbyns connection");

      let lobby = null;

      socket.on("disconnect", () => {
        if (lobby) {
          lobby.members--;
          ionsp.to(lobby.id).emit("server:lobby-connected-users", lobby.members);
        }
      });

      socket.on('client:join-lobby', (lobbyid) => {
        debug("socket.io /lobbyns:join-lobby lobbyid: " + lobbyid);
        if (lobby === null) {
          if (!lobbies[lobbyid]) {
            debug("ERROR: lobbyid does not exist: " + lobbyid);
            socket.emit("server:error", "this lobby does not exist");
            return ;
          }
          lobby = lobbies[lobbyid];
          lobby.members++;
          socket.join(lobby.id);

          // broadcast the nowPlaying event to the new member :P
          if (lobby.nowPlaying) {
            socket.emit("server:play-video", lobby.nowPlaying);
          } else {
            socket.emit("server:error", "this lobby is not playing anything, you should never be able to join a lobby with no now playing");
          }

          socket.emit("server:curtime", (new Date).getTime());
          
          ionsp.to(lobby.id).emit("server:lobby-connected-users", lobby.members);
        } else {
          socket.emit("server:error", "you already joined a room");
        }
      });

      socket.on("client:update-now-playing", (nowPlaying) => {
        if (!lobby) {
          socket.emit("server:error", "you are not in a room yet");
          return ;
        }

        debug("client:update-now-playing for lobby " + lobby.id, JSON.stringify(nowPlaying, false, 3));

        lobby.setNowPlaying(nowPlaying);
      });

      socket.on("client:message", (message) => {
        debug("client:message relaying message '", message, "'");
        socket.to(lobby.id).emit("server:message", message);
      });

    });
  }
}