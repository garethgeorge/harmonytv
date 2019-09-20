import React from "react";
import config from "../config";
import Player from "./player";
import io from 'socket.io-client'

class Lobby extends React.Component {
  state = {}
  
  constructor(props) {
    super(props);
    console.log("Lobby::constructor - lobbyid: " + props.lobbyid);
  }

  setupMediaPlayer(player) {
    this.player = player;
    
    const setup = () => {
      if (!player.shakaUi) // spin until the shakaUi is available
        return setTimeout(setup, 20);

      // connect to socket.io 
      this.socket = io(config.apiHost + "/lobbyns");
      this.socket.emit("client:join-lobby", this.props.lobbyid);

      let lastNowPlaying = null;
      const getPlaybackPosition = (nowPlaying) => {
        return ((new Date).getTime() - nowPlaying.updateTime) / 1000 + nowPlaying.position;
      }

      const nowPlayingsAreDifferent = (a, b) => {
        if (a.state != b.state)
          return true;
        if (Math.abs(getPlaybackPosition(a) - getPlaybackPosition(b)) > 5)
          return true;
        if (a.mediaid != b.mediaid) 
          return true;
        return false;
      }

      const applyNowPlaying = (nowPlaying) => {
        if (lastNowPlaying !== null)
          console.log("\tdiffing now playings: ", nowPlayingsAreDifferent(nowPlaying, lastNowPlaying));
        if (lastNowPlaying !== null && !nowPlayingsAreDifferent(nowPlaying, lastNowPlaying))
          return 

        lastNowPlaying = nowPlaying;

        if (nowPlaying.state === "playing") 
          this.player.videoElem.play();
        else
          this.player.videoElem.pause();
        this.player.videoElem.currentTime = getPlaybackPosition(nowPlaying);
      }

      this.socket.on("server:play-video", (nowPlaying) => {
        console.log("server:play-video: ", JSON.stringify(nowPlaying, false, 3));
        this.player.playVideo(nowPlaying.mediaid);

        applyNowPlaying(nowPlaying);
      });

      this.socket.on("server:update-now-playing", (nowPlaying) => {
        console.log("server:update-now-playing: " + JSON.stringify(nowPlaying));
        applyNowPlaying(nowPlaying);
      })

      this.player.videoElem.addEventListener("playing", () => {
        console.log("this.player.videoElem was paused, emitting new now playing w/position: " + this.player.videoElem.currentTime);
        const nowPlaying = {
          updateTime: (new Date).getTime(), // the time at which it was updated 
          position: this.player.videoElem.currentTime, // the position when it was updated 
          mediaid: lastNowPlaying.mediaid, // the media id playing 
          state: "playing", // the state (can also be paused)
        };
        this.socket.emit("client:update-now-playing", nowPlaying);
      });

      this.player.videoElem.addEventListener("pause", () => {
        console.log("this.player.videoElem was paused, emitting new now playing w/position: " + this.player.videoElem.currentTime);
        const nowPlaying = {
          updateTime: (new Date).getTime(), // the time at which it was updated 
          position: this.player.videoElem.currentTime, // the position when it was updated 
          mediaid: lastNowPlaying.mediaid, // the media id playing 
          state: "pause", // the state (can also be paused)
        };
        this.socket.emit("client:update-now-playing", nowPlaying);
      });

      // NOTES: https://github.com/google/shaka-player/issues/416
    }
    setup();
  }

  render() {
    return (
      <Player ref={(elem) => this.setupMediaPlayer(elem)}/>
    );
  }
}

export default Lobby;