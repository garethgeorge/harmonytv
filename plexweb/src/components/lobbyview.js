import React from "react";
import config from "../config";
import io from 'socket.io-client'
import "./lobbyview.css"; 
import Player from "./player"

let delta = 0;

const curTimeMilliseconds = () => {
  return (new Date).getTime() + delta;
}

class NowPlaying {
  constructor(nowPlaying) {
    this.nowPlaying = nowPlaying;
  }

  getMediaID() {
    return this.nowPlaying.mediaid;
  }

  getPlaybackPosition() {
    const nowPlaying = this.nowPlaying;
    if (nowPlaying.state === "playing") {
      // return ((new Date).getTime() - nowPlaying.updateTime + delta) / 1000 + nowPlaying.position;
      return (curTimeMilliseconds() - nowPlaying.updateTime) / 1000 + nowPlaying.position;
    } else 
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
    console.log("SETTING player.currentTime = " + this.getPlaybackPosition());
    player.currentTime = this.getPlaybackPosition();
  }
}

class ChatBox extends React.Component {
  state = {
    composition: "",
    messages: [],
    users: 1,
  }

  addMessage(message) {
    const removeAMessage = (delay) => {
      setTimeout(() => {
        const state = Object.assign({}, this.state);
        state.messages = this.state.messages.slice(0);
        state.messages.shift();
        this.setState(state);
      }, delay);
    }

    const state = Object.assign({}, this.state);
    state.messages = this.state.messages.slice(0);
    state.messages.push(">" + message);
    this.setState(state);

    removeAMessage(10000);
  }

  constructor(props) {
    super(props);

    this.props.socket.on("server:message", (message) => {
      this.addMessage(message);
    });

    this.props.socket.on("server:lobby-connected-users", (users) => {
      const state = Object.assign({}, this.state);
      state.users = users;
      this.setState(state, () => {
        this.addMessage(users + " total users are now connected.");
      });
    });

  }

  render() {
    if (this.state.users <= 1)
      return (<div></div>);

    const messages = [];
    for (const message of this.state.messages) {
      messages.push(<span className="message" key={Math.random()}>{message}</span>);
    }

    return (
      <div className="chatbox">
        {messages}
        {/* functionally this is padding */}
        <div style={{height: "30px", color: "red"}}></div> 
        {/* this is the actual text input */}
        <input className="chatboxTextEntry" type="text" 
          value={this.state.composition}
          onChange={(e) => {
            const state = Object.assign({}, this.state);
            state.composition = e.target.value;
            this.setState(state);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const state = Object.assign({}, this.state)
              const composition = this.state.composition;
              state.composition = "";
              this.setState(state, () => {
                this.addMessage(composition);
                this.props.socket.emit("client:message", composition);
              });
            }
          }}/>
      </div>
    )
  }
};

class Lobby extends React.Component {
  state = {}
  
  constructor(props) {
    super(props);
    console.log("Lobby::constructor - lobbyid: " + props.lobbyid);
    
    this.socket = io("/lobbyns");
  }

  setupMediaPlayer(player) {
    console.log("setting up the media player");
    this.player = player; // the player element 
    this.socket.emit("client:join-lobby", this.props.lobbyid);

    let serverNowPlaying = null;
    let transmitTimeoutRef = null;

    this.socket.on("server:curtime", time => {
      delta = time - (new Date).getTime();
      console.log("server:curtime servertime: ", time, "delta: ", delta);
    });

    // TODO: consider what happens when the play-video function is fired when the lobby is already playing something :P
    this.socket.on("server:play-video", (nowPlaying) => {
      console.log("server:play-video: ", JSON.stringify(nowPlaying, false, 3));
      // we don't actually respond to changes to mediaid other than here 
      this.player.playVideo(nowPlaying.mediaid, () => {
        serverNowPlaying = new NowPlaying(nowPlaying);
        clearTimeout(transmitTimeoutRef);
        
        setTimeout(() => {
          serverNowPlaying.apply(this.player.videoElem);
        }, 4000);
        

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
        
        // prevent any state from propogating in the first 10 seconds
        let settingUp = true;
        setTimeout(() => settingUp = false, 10000);
        
        const updateState = () => {
          if (settingUp)
            return ;
    
          const newState = {
            updateTime: curTimeMilliseconds(), // the time at which it was updated 
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
            console.log("SENDING MESSAGE TO SET PLAYER.currentTime to " +  new NowPlaying(newState).getPlaybackPosition());
          }, 100);
        }
    
        this.player.videoElem.addEventListener("playing", updateState);
        this.player.videoElem.addEventListener("pause", updateState);
      });
      
    });

    // NOTES: https://github.com/google/shaka-player/issues/416
  }


  render() {
    console.log("rendering the video player...");
    const onRef = (elem) => {
      this.player = elem;
      const retry = () => {
        if (!this.player || !this.player.videoElem)
          return setTimeout(retry, 50);
        this.setupMediaPlayer(elem);
      }
      retry();
    };

    return (
      <div className="lobbyview">
        <Player ref={onRef}/>
        <ChatBox socket={this.socket} />
      </div>
    );
  }
}

export default Lobby;