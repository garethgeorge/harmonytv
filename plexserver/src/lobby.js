const uuidv4 = require("uuid/v4");

const lobbies = {};

class Lobby {
  constructor() {
    this.id = uuidv4();
    this.nowPlaying = null; // the media file currently playing
    this.createdTime = (new Date).getTime(); 
    this.members = 0;
  }

  getAge() {
    return (new Date).getTime() - this.createdTime;
  }
  
  startPlaying(mediaid) {
    this.nowPlaying = {
      updateTime: (new Date).getTime(), // the time at which it was updated 
      position: 0, // the position when it was updated 
      mediaid: mediaid, // the media id playing 
      state: "playing", // the state (can also be paused)
    }
  }
};

// sweep old lobbies 
setInterval(() => {
  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];

    if (lobby.getAge() > 30 * 1000 && lobby.members === 0) {
      delete lobbies[lobbyId];
    }
  }
}, 30 * 1000);

module.exports = {
  create: () => {
    const lobby = new Lobby;
    lobbies[lobby.id] = lobby;
    return lobby;
  },

  get: (id) => {
    return lobbies[id] || null;
  },

  socketio_setup: (ionsp) => {
    ionsp.on("connection", (socket) => {
      console.log("socket.io /lobbyns connection");

      let lobby = null;

      socket.on("disconnect", () => {
        if (lobby) {
          lobby.members--;
        }
      });

      socket.on('client:join-lobby', (lobbyid) => {
        console.log("socket.io /lobbyns:join-lobby lobbyid: " + lobbyid);
        if (lobby === null) {
          if (!lobbies[lobbyid]) {
            console.log("ERROR: lobbyid does not exist: " + lobbyid);
            socket.emit("server:error", "this lobby does not exist");
            return ;
          }
          lobby = lobbies[lobbyid];
          lobby.members++;
          socket.join(lobby.id);

          // broadcast the nowPlaying event to the new member :P
          if (lobby.nowPlaying) {
            socket.emit("server:play-video", lobby.nowPlaying);
          }
        } else {
          socket.emit("server:error", "you already joined a room");
        }
      });

      socket.on('client:play-video', (mediaid) => {
        console.log("socket.io /lobbyns:play-video lobbyid: " + lobbyid + " mediaid: " + mediaid);
        if (!lobby) {
          socket.emit("server:error", "you are not in a room yet");
          return ;
        }

        lobby.startPlaying(mediaid);
        ionsp.in(lobby.id).emit("server:play-video", lobby.nowPlaying);
      });

      socket.on("client:update-now-playing", (nowPlaying) => {
        if (!lobby) {
          socket.emit("error", "you are not in a room yet");
          return ;
        }
        lobby.nowPlaying = nowPlaying;
        socket.to(lobby.id).emit("server:update-now-playing", lobby.nowPlaying);
      });

    });
  }
}