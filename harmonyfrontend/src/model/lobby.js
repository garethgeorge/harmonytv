import axios from "axios";
import config from "../config";
import uuidv4 from "uuid/v4";
import model from ".";
const debug = require("debug")("model:lobby");

export default {
  create: async mediaid => {
    const res = await axios.get(
      config.apiHost + "/lobby/create?mediaid=" + mediaid
    );
    debug(
      "created lobby playing media: " +
        mediaid +
        " lobbyid: " +
        res.data.lobbyId
    );
    return res.data.lobbyId;
  },

  syncVideoWithLobby: (socket, player) => {
    const video = player.videoElem;
    let currentlyPlayingVideo = null;

    /*
      time synchronization
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
      video and queue synchronization
    */
    let syncState = null;
    let videoQueue = null;

    socket.on("server:sync-queue", _videoQueue => {
      debug("server:sync-queue: " + JSON.stringify(_videoQueue, false, 2));
      videoQueue = _videoQueue;

      if (
        videoQueue.videos.length > 0 &&
        videoQueue.videos[0] !== currentlyPlayingVideo
      ) {
        debug(
          "DETECTED DIFFERENT VIDEO AT HEAD OF QUEUE! Now playing video: " +
            videoQueue.videos[0]
        );
        currentlyPlayingVideo = videoQueue.videos[0];
        player.playVideo(currentlyPlayingVideo, () => {
          debug("\tsuccessfully played " + currentlyPlayingVideo);
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
      syncState = _syncState;
      didAck = false;
      if (!amInSync()) applySyncState(syncState);

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
          applySyncState(syncState);
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

    return () => {
      clearInterval(updateResumeWatchingTimer);
    };
  }
};
