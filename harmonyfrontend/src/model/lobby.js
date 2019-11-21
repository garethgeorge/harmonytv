import axios from "axios";
import config from "../config";
import uuidv4 from "uuid/v4";
import state from "./state";
import model from ".";
const debug = require("debug")("model:lobby");

export default {
  create: async mediaid => {
    const res = await axios.get(
      config.apiHost + "/lobby/create?mediaid=" + mediaid
    );
    debug(
      "fd lobby playing media: " + mediaid + " lobbyid: " + res.data.lobbyId
    );
    return res.data.lobbyId;
  },

  setQueue: async (lobbyid, newQueue) => {
    const res = await axios.post(
      config.apiHost + "/lobby/" + lobbyid + "/setQueue",
      newQueue
    );
    if (res.data.error) throw new Error(res.data.error);
  },

  playNextInQueue: async () => {
    const newQueue = {
      queueId: uuidv4(),
      videos: state.videoQueue.videos.slice(1)
    };
    await model.lobby.setQueue(model.state.lobbyid, newQueue);
  },

  syncVideoWithLobby: (socket, player) => {
    const video = player.videoElem;
    let currentlyPlayingVideo = null;

    /*
      time synchronization
      TODO: add ping based offset
    */
    let delta = 0;
    socket.on("server:curtime", time => {
      delta = time - new Date().getTime();
      debug("server:curtime servertime: ", time, "delta: ", delta);
    });

    const curTime = () => {
      return new Date().getTime() + delta;
    };

    /*
      synchronize the number of currently connected users
    */
    let numConnectedUsers = 0;
    socket.on("server:lobby-connected-users", _numConnectedUsers => {
      if (numConnectedUsers === 0 && _numConnectedUsers === 1) {
        // autoplay the video if we are the first user to connect to the lobby
        const toClear = setInterval(() => {
          if (
            syncState != null &&
            (!player.shakaPlayer || !player.shakaPlayer.isBuffering())
          ) {
            video.play();
            clearInterval(toClear);
          }
        }, 500);
      }

      numConnectedUsers = _numConnectedUsers;
    });

    /*
      video and queue synchronization
    */
    let syncState = null;
    let videoQueue = null;

    socket.on("server:sync-queue", _videoQueue => {
      debug("server:sync-queue: " + JSON.stringify(_videoQueue, false, 2));
      state.videoQueue = _videoQueue;
      videoQueue = _videoQueue;

      if (
        videoQueue.videos.length > 0 &&
        videoQueue.videos[0] !== currentlyPlayingVideo
      ) {
        if (currentlyPlayingVideo !== null) {
          // ! whenever a new video starts rolling in an existing lobby, it means we skipped to the next video
          // we should then automatically message the server to seek to the beginning of the new video
          debug(
            "sending a new sync state to the server to trigger new video to play"
          );
          socket.emit("client:sync-playback-state", {
            updateTime: curTime(), // the time at which it was updated
            position: 0, // the position when it was updated
            state: "playing", // the state (can also be paused)
            stateId: uuidv4()
          });
        }

        debug(
          "DETECTED DIFFERENT VIDEO AT HEAD OF QUEUE! Now playing video: " +
            videoQueue.videos[0]
        );
        currentlyPlayingVideo = videoQueue.videos[0];
        player.playVideo(currentlyPlayingVideo, () => {
          debug("\tsuccessfully played " + currentlyPlayingVideo);
          applySyncState();
        });
        model.media
          .getInfo(currentlyPlayingVideo)
          .then(mediaInfo => {
            debug("GOT THE MEDIA INFO: " + JSON.stringify(mediaInfo, false, 3));
            document.title = mediaInfo.name;
          })
          .catch(err => {
            alert(err);
          });
      }
    });

    const getSyncVideoPosition = () => {
      if (syncState.state === "playing") {
        return (curTime() - syncState.updateTime) / 1000 + syncState.position;
      } else {
        return syncState.position;
      }
    };

    const applySyncState = () => {
      if (!syncState) return;

      if (syncState.state == "paused") {
        video.pause();
      } else if (syncState.state == "playing") {
        video.play();
      }
      video.currentTime = getSyncVideoPosition();
    };

    const amInSync = () => {
      const syncPos = getSyncVideoPosition();
      if (Math.abs(video.currentTime - syncPos) > 0.5) return false;
      if (syncState.state === "paused" && !video.paused) return false;
      if (syncState.state === "playing" && video.paused) return false;
      return true;
    };

    let syncPlaybackStateTimer = null;
    let didAck = false;
    socket.on("server:sync-playback-state", _syncState => {
      // special case sync handling for lobby with only one user
      if (numConnectedUsers <= 1) {
        syncState = _syncState;
        applySyncState();
        socket.emit("client:ack-state", _syncState.stateId);
        return;
      }

      // much more complicated sync handling code for the case where there
      // are many users -- this is to avoid the formation of sync cycles / race conditions
      syncState = _syncState;
      didAck = false;
      if (!amInSync()) applySyncState();

      debug("server:sync-playback-state: ", syncState);

      // set a timer up to synchronize us
      if (syncPlaybackStateTimer) clearInterval(syncPlaybackStateTimer);
      syncPlaybackStateTimer = setInterval(() => {
        debug("\tattempting to apply sync state: ", syncState);
        if (amInSync()) {
          debug("\t\tWE ARE IN SYNC!");

          if (
            !player.shakaPlayer ||
            (!didAck &&
              (!player.shakaPlayer.isBuffering() ||
                (video.duration && getSyncVideoPosition() > video.duration))) // the last condition is needed to deal with the case when we are very close to the end of the video and possibly get stuck
          ) {
            didAck = true;
            socket.emit("client:ack-state", syncState.stateId); // tell the server we sync'd
          }
        } else {
          debug("\t\tsync is still in progress, working on it.");
          applySyncState();
        }
      }, 1000);
    });

    // send state updates to the server
    const makeStateChangeRequest = () => {
      if (amInSync()) {
        return;
      }
      clearInterval(syncPlaybackStateTimer);

      const newState = {
        updateTime: curTime(), // the time at which it was updated
        position: video.currentTime, // the position when it was updated
        state: player.videoElem.paused ? "paused" : "playing", // the state (can also be paused)
        stateId: uuidv4()
      };

      syncState = newState;

      socket.emit("client:sync-playback-state", newState);
    };

    video.addEventListener("playing", makeStateChangeRequest);
    video.addEventListener("pause", makeStateChangeRequest);
    video.addEventListener("seeking", () => {
      // TODO: clean this up by merging duplicate code with makeStateChangeRequest
      if (amInSync()) {
        return;
      }
      clearInterval(syncPlaybackStateTimer);

      // synchronize state as paused
      const newState = {
        updateTime: curTime(),
        position: video.currentTime,
        state: "paused",
        stateId: uuidv4()
      };
      syncState = newState;
      video.pause();
      socket.emit("client:sync-playback-state", newState);

      // once everyon is ready, play the video, and resync the state automatically
      const onceSynchronized = stateId => {
        if (stateId === newState.stateId) {
          socket.removeListener("server:all-clients-acked", onceSynchronized);
          video.play();
          makeStateChangeRequest();
        }
      };
      socket.on("server:all-clients-acked", onceSynchronized);

      if (currentlyPlayingVideo) {
        model.user.updateResumeWatching(
          currentlyPlayingVideo,
          video.currentTime,
          video.duration
        );
      }
    });

    const updateResumeWatchingTimer = setInterval(() => {
      if (currentlyPlayingVideo) {
        model.user.updateResumeWatching(
          currentlyPlayingVideo,
          video.currentTime,
          video.duration
        );
      }
    }, 30000);

    video.addEventListener("ended", () => {
      if (videoQueue.videos.length > 1) {
        model.lobby.playNextInQueue();
      }
    });

    return () => {
      clearInterval(updateResumeWatchingTimer);
    };
  }
};
