import React from "react";
import io from 'socket.io-client'
import Player from "../../components/player";
import model from "../../model/";
import config from "../../config";
import "./lobbyview.scss";

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
    docked: false,
    side: "left",
  }

  addMessage(messagetext, opts={}) {
    // const index = this.state.messages.length;
    const options = Object.assign({kind: "message"}, opts);

    const removeMessage = (message, delay) => {
      setTimeout(() => {
        // const state = Object.assign({}, this.state);
        // state.messages = this.state.messages.slice(0);
        // state.messages.shift();
        // this.setState(state);
        //
        message.data.classlist.push('old');
        this.setState(this.state);
        // console.log('MESSAGE:', this.state.messages[index]);
      }, delay);
    }

    const state = Object.assign({}, this.state);
    var message = {text: messagetext, kind: options.kind, data: {classlist: []}};
    state.messages = this.state.messages.slice(0);
    state.messages.push(message);
    this.setState(state);

    removeMessage(message, 15000);
    return message;
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
        this.addMessage(users + " total users are now connected.", {kind: "notification"});
      });
    });
  }

  render() {
    if (this.state.users <= 1)
      return (<div></div>);

    const messages = [];
    for (const message of this.state.messages) {
      messages.push(<span className={"chat-text " + message.kind + " " + message.data.classlist.join(" ")} key={Math.random()}>{message.text}</span>);
    }

    return (
      <div className={"chatbox " + (this.state.docked ? "docked " : "") + this.state.side}>
        <div className="messages">{messages}</div>
        {/* functionally this is padding */}
        <div style={{ height: "30px", color: "red" }}></div>
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
                const message = model.state.user.username + ": " + composition;
                this.addMessage(message);
                // send the message if it is not a special command
                if (composition[0] != "\\") {
                  this.props.socket.emit("client:message", message);
                } else { // do the command if it is known
                  const args = composition.split(' ');
                  const command = args[0].substr(1);
                  const argnum = args.length;
                  if (command == "dock" || command == "float") {
                    this.state.docked = (command=="dock"); // dock on "dock", undock on "float".
                    if (argnum > 1) {
                      if (args[1] == "left" || args[1] == "right") {
                        this.state.side = args[1];
                      }
                    }
                    this.addMessage('Chatbox '+command+'ed '+this.state.side+'.', {kind: "notification"});
                  } else if (command == "?" || command == "help") {
                    this.addMessage('Commands you can use: \n \\help - this list \n \\dock [side] - dock the chat \n \\float [side] - float the chat', {kind: "notification"});
                  } else {
                    this.addMessage('Unknown command "'+composition+'".', {kind: "notification"});
                  }
                }
              });
            }
          }} />
      </div>
    )
  }
};

class Lobby extends React.Component {
  state = {}

  constructor(props) {
    super(props);
    console.log("Lobby::constructor - lobbyid: " + props.lobbyid);

    this.socket = io(config.host + "/lobbyns");
    this.socket.on("error", console.error);
    console.log("\tlobby connecting to socket: " + config.apiHost + "/lobbyns");
    // this.socket.connect(config.apiHost);
    this.player = React.createRef();
  }

  componentDidMount() {
    // TODO: this code needs major cleanup work
    // mainly things need to be factored into reasonable functions etc.

    const player = this.player.current;

    console.log("setting up the media player");
    this.socket.emit("client:join-lobby", this.props.lobbyid);

    let serverNowPlaying = null;
    let transmitTimeoutRef = null;

    this.socket.on("server:curtime", time => {
      delta = time - (new Date).getTime();
      console.log("server:curtime servertime: ", time, "delta: ", delta);
    });

    this.socket.on("server:play-video", (nowPlaying) => {
      console.log("server:play-video: ", JSON.stringify(nowPlaying, false, 3));
      // we don't actually respond to changes to mediaid other than here

      player.playVideo(nowPlaying.mediaid, () => {
        serverNowPlaying = new NowPlaying(nowPlaying);
        clearTimeout(transmitTimeoutRef);

        // immediately try to play it :P
        setTimeout(() => {
          serverNowPlaying.apply(player.videoElem);
        }, 100);

        // synchronize the current playback position with the server every 30 seconds
        setInterval(() => {
          // TODO: avoid updating now playing when it is already up-to date
          if (player.videoElem.paused)
            return;

          const video = player.videoElem;
          console.log("updateResumeWatching - timer fired, submitting position: " + video.currentTime + " duration: " + video.duration);
          model.user.updateResumeWatching(nowPlaying.mediaid, video.currentTime, video.duration);
        }, 30 * 1000);

        this.socket.on("server:update-now-playing", (nowPlaying) => {
          console.log("server:update-now-playing ", JSON.stringify(nowPlaying, false, 3));
          const newNowPlaying = new NowPlaying(nowPlaying);
          if (serverNowPlaying.isSame(newNowPlaying)) {
            console.log("\tskipping server state update, it is the same");
            return;
          }

          console.log("\tapplying state update");
          serverNowPlaying = newNowPlaying;
          clearTimeout(transmitTimeoutRef);
          serverNowPlaying.apply(player.videoElem);
        });

        // disable sending state updates for the first 10 seconds
        setTimeout(() => {
          serverNowPlaying.apply(player.videoElem);

          // prevent any state from propogating in the first 10 seconds
          const updateState = () => {
            const newState = {
              updateTime: curTimeMilliseconds(), // the time at which it was updated
              position: player.videoElem.currentTime, // the position when it was updated
              mediaid: serverNowPlaying.getMediaID(), // the media id playing
              state: player.videoElem.paused ? "paused" : "playing", // the state (can also be paused)
            };

            console.log("detected state update event from video player: ", JSON.stringify(newState, false, 3));
            const newStateNowPlaying = new NowPlaying(newState);

            if (newStateNowPlaying.isSame(serverNowPlaying)) {
              console.log("\tnot synchronizing state update, it is a result of a server message");
              return;
            }

            if (transmitTimeoutRef)
              clearTimeout(transmitTimeoutRef);

            transmitTimeoutRef = setTimeout(() => {
              serverNowPlaying = newStateNowPlaying;
              this.socket.emit("client:update-now-playing", newState);
              console.log("SENDING MESSAGE TO SET PLAYER.currentTime to " + new NowPlaying(newState).getPlaybackPosition());

              const video = player.videoElem;
              console.log("SENDING 'RESUME PLAYING STATE' TO SERVER: " + video.currentTime + " duration: " + video.duration);
              model.user.updateResumeWatching(nowPlaying.mediaid, video.currentTime, video.duration);
            }, 100);
          }

          player.videoElem.addEventListener("playing", updateState);
          player.videoElem.addEventListener("pause", updateState);
        }, 4000);
      });

    });

    // NOTES: https://github.com/google/shaka-player/issues/416
  }

  render() {
    console.log("rendering the video player...");

    return (
      <div className="lobbyview">
        <Player ref={this.player} />
        <ChatBox socket={this.socket} />
      </div>
    );
  }
}

export default Lobby;
