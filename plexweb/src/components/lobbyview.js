import React from "react";
import config from "../config";
import Player from "./player";
import io from 'socket.io-client'


class NowPlaying {
  constructor(nowPlaying) {
    this.nowPlaying = nowPlaying;
  }

  getMediaID() {
    return this.nowPlaying.mediaid;
  }

  getPlaybackPosition() {
    const nowPlaying = this.nowPlaying;
    if (nowPlaying.state === "playing")
      return ((new Date).getTime() - nowPlaying.updateTime) / 1000 + nowPlaying.position;
    else 
      return nowPlaying.position;
  }

  isSame(other) {
    return (
      Math.abs(this.getPlaybackPosition() - other.getPlaybackPosition()) < 5 &&
      this.nowPlaying.state === other.nowPlaying.state 
    );
  }

  apply(player) {
    if (this.nowPlaying.state == "paused") {
      console.log("\tattempting to pause video");
      player.pause();
    } else if (this.nowPlaying.state == "playing") {
      console.log("\tattempting to play video");
      player.play();
    }
    player.currentTime = this.getPlaybackPosition();
  }
}

class Lobby extends React.Component {
  state = {}
  
  constructor(props) {
    super(props);
    console.log("Lobby::constructor - lobbyid: " + props.lobbyid);
  }

  setupMediaPlayer(player) {
    this.player = player; // the player element 
    
    this.socket = io(config.apiHost + "/lobbyns");
    this.socket.emit("client:join-lobby", this.props.lobbyid);

    let serverNowPlaying = null;
    let transmitTimeoutRef = null;

    this.socket.on("server:play-video", (nowPlaying) => {
      console.log("server:play-video: ", JSON.stringify(nowPlaying, false, 3));
      // we don't actually respond to changes to mediaid other than here 
      this.player.playVideo(nowPlaying.mediaid, () => {
        serverNowPlaying = new NowPlaying(nowPlaying);
        clearTimeout(transmitTimeoutRef);

        setTimeout(() => {
          serverNowPlaying.apply(this.player.videoElem);
        }, 100);
        

        this.socket.on("server:update-now-playing", (nowPlaying) => {
          console.log("server:update-now-playing ", JSON.stringify(nowPlaying, false, 3));
          const newNowPlaying = new NowPlaying(nowPlaying);
          if (serverNowPlaying.isSame(newNowPlaying)) {
            console.log("\tskipping server state update, it is the same");
            return ;
          } 

          console.log("\tapplying state update");
          serverNowPlaying = newNowPlaying;
          clearTimeout(transmitTimeoutRef);
          serverNowPlaying.apply(this.player.videoElem);
        });
        
        // prevent any state from propogating in the first 4 seconds
        let settingUp = true;
        setTimeout(() => settingUp = false, 4000);
        
        const updateState = () => {
          if (settingUp)
            return ;
    
          const newState = {
            updateTime: (new Date).getTime(), // the time at which it was updated 
            position: this.player.videoElem.currentTime, // the position when it was updated 
            mediaid: serverNowPlaying.getMediaID(), // the media id playing 
            state: this.player.videoElem.paused ? "paused" : "playing", // the state (can also be paused)
          };
    
          console.log("player state updated...", JSON.stringify(newState, false, 3));
    
    
          const newStateNowPlaying = new NowPlaying(newState);
    
          if (newStateNowPlaying.isSame(serverNowPlaying)) {
            console.log("\tnot synchronizing state update, it is a result of a server message");
            return ;
          }

          if (transmitTimeoutRef)
            clearTimeout(transmitTimeoutRef);
          
          transmitTimeoutRef = setTimeout(() => {
            serverNowPlaying = newStateNowPlaying;
            this.socket.emit("client:update-now-playing", newState);
          }, 100);
        }
    
        this.player.videoElem.addEventListener("playing", updateState);
        this.player.videoElem.addEventListener("pause", updateState);
      });
      
    });

    // NOTES: https://github.com/google/shaka-player/issues/416
  }


  render() {
    const onRef = (elem) => {
      this.player = elem;
      const retry = () => {
        if (!this.player || !this.player.shakaUi)
          return setTimeout(retry, 50);
        this.setupMediaPlayer(elem);
      }
      retry();
    };

    return (
      <Player ref={onRef}/>
    );
  }
}

export default Lobby;