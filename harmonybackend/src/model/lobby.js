const uuidv4 = require("uuid/v4");
const debug = require("debug")("model:lobby");
const util = require("../util");
const wordlist = require("wordlist-english").english;

let ionsp = null;

const lobbies = {};

class Lobby {
  constructor(media) {
    this.media = media;

    this.id = new Array(3)
      .fill("")
      .map(() => {
        return wordlist[Math.floor(Math.random() * wordlist.length)];
      })
      .join("-");

    this.videoQueue = {
      queueId: uuidv4(),
      videos: [this.media.mediaid]
    };

    // set the initial playing time
    this.syncState = {
      stateId: uuidv4(),
      updateTime: new Date().getTime(), // the time at which it was updated
      position: 0, // the position when it was updated
      state: "paused" // the state (can also be paused)
    };

    // the stateId's that the clients acknowledge as their current states
    this.clientAckStates = {};
  }

  addClient(socket) {
    this.clientAckStates[socket.id] = null;
  }

  removeClient(socket) {
    delete this.clientAckStates[socket.id];
  }

  numUptodateClients() {
    // returns the number of clients who have yet to synchronize w/the current state
    let count = 0;
    for (const stateId of Object.values(this.clientAckStates)) {
      if (stateId === this.syncState.stateId) count++;
    }
    return count;
  }

  clientIsUpToDate(socket) {
    return this.clientAckStates[socket.id] === this.syncState.stateId;
  }

  numConnectedClients() {
    return Object.keys(this.clientAckStates).length;
  }

  setSyncPosition(position) {
    const copy = Object.assign({}, this.syncState);
    copy.position = position;
    copy.stateId = uuidv4();
    return this.setSyncState(copy);
  }

  setSyncState(syncState) {
    if (syncState.stateId === this.syncState.stateId) {
      throw new Error("setting the same state again!");
    }

    this.syncState = syncState;
    ionsp.in(this.id).emit("server:sync-playback-state", syncState);
  }

  setVideoQueue(queue) {
    this.videoQueue = Object.assign({}, queue);
    ionsp.in(this.id).emit("server:sync-queue", this.videoQueue);
  }

  getVideoQueue(queue) {
    return this.videoQueue;
  }

  syncWithNewClient(socket) {
    socket.emit("server:sync-queue", this.videoQueue);
    socket.emit("server:sync-playback-state", this.syncState);
  }

  sendSyncStateToClient(socket) {
    socket.emit("server:sync-playback-state", this.syncState);
  }
}

module.exports = {
  create: media => {
    if (!media) throw new Error("required media to be valid");

    const lobby = new Lobby(media);
    lobbies[lobby.id] = lobby;
    return lobby;
  },

  get: id => {
    return lobbies[id] || null;
  },

  socketio_setup: _ionsp => {
    ionsp = _ionsp;

    setInterval(() => {
      ionsp.emit("server:curtime", new Date().getTime());
    }, 30000);

    ionsp.on(
      "connection",
      util.nothrow(socket => {
        debug("socket.io /lobbyns connection");

        let lobby = null;

        socket.on(
          "disconnect",
          util.nothrow(() => {
            if (lobby) {
              lobby.removeClient(socket);
              ionsp
                .to(lobby.id)
                .emit(
                  "server:lobby-connected-users",
                  lobby.numConnectedClients()
                );
            }
          })
        );

        socket.on(
          "client:join-lobby",
          util.nothrow(lobbyid => {
            debug("socket.io /lobbyns:join-lobby lobbyid: " + lobbyid);
            if (lobby === null) {
              if (!lobbies[lobbyid]) {
                debug("ERROR: lobbyid does not exist: " + lobbyid);
                socket.emit("server:error", "this lobby does not exist");
                return;
              }
              lobby = lobbies[lobbyid];

              socket.join(lobby.id);
              lobby.addClient(socket);
              lobby.syncWithNewClient(socket);

              socket.emit("server:curtime", new Date().getTime());

              ionsp
                .to(lobby.id)
                .emit(
                  "server:lobby-connected-users",
                  lobby.numConnectedClients()
                );
            } else {
              socket.emit("server:error", "you already joined a room");
            }
          })
        );

        socket.on(
          "client:sync-playback-state",
          util.nothrow(syncState => {
            if (!lobby) {
              socket.emit("server:error", "you are not in a room yet");
              return;
            }

            debug(
              "client:sync-playback-state for lobby " + lobby.id,
              JSON.stringify(syncState, false, 3)
            );

            if (lobby.clientIsUpToDate(socket)) {
              debug("\tclient was in sync, broadcasting state update");
              // reflect that they are up to date (they emitted this state)
              lobby.clientAckStates[socket.id] = syncState.stateId;
              lobby.setSyncState(syncState);
            } else {
              debug("\tclient not in sync, forcing a resync");
              // resubmit the current state to the client so that they can
              // continue to try to sync with it
              lobby.sendSyncStateToClient(socket);
            }
          })
        );

        socket.on("client:ack-state", stateId => {
          if (!lobby) {
            socket.emit("server:error", "you are not connected to a lobby");
            return;
          }

          debug("received client:ack-state: " + stateId);

          lobby.clientAckStates[socket.id] = stateId;

          if (lobby.numUptodateClients() === lobby.numConnectedClients()) {
            ionsp.to(lobby.id).emit("server:all-clients-acked", stateId);
          }

          debug(
            "number of up to date clients: " +
              lobby.numUptodateClients() +
              " total num connected: " +
              lobby.numConnectedClients()
          );
        });

        socket.on(
          "client:message",
          util.nothrow(message => {
            if (!lobby) {
              socket.emit("server:error", "you are not connected to a lobby");
              return;
            }
            debug("client:message relaying message '", message, "'");
            socket.to(lobby.id).emit("server:message", message);
          })
        );
      })
    );
  }
};
