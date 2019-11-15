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

  ageMessage(message, delay=15000) {
    setTimeout(() => {
      message.data.classlist.push('old');
      this.setState(this.state);
    }, delay);
  }

  addMessage(messagetext, opts={}) {
    // const index = this.state.messages.length;
    const options = Object.assign({kind: "message"}, opts);

    const state = Object.assign({}, this.state);
    var message = {text: messagetext, kind: options.kind, data: {classlist: []}};
    state.messages = this.state.messages.slice(0);
    state.messages.push(message);
    this.setState(state);

    this.ageMessage(message);
    return message;
  }

  chatCommand(composition) {
    const args = composition.split(' ');
    const argnum = args.length;
    const command = args[0].substr(1);

    // \DOCK, \FLOAT
    if (command == "dock" || command == "float") {
      this.state.docked = (command=="dock"); // dock on "dock", undock on "float".
      if (argnum > 1) {
        if (args[1] == "left" || args[1] == "right") {
          this.state.side = args[1];
        }
      }
      this.addMessage('Chatbox '+command+'ed '+this.state.side+'.', {kind: "success"});
    }
    // \HELP, \?
    else if (command == "?" || command == "help") {
      this.addMessage(
        <div>
          Commands:
          <ul className="command-list">
            <li><span className="command">\help</span>, <span className="command">\?</span> brings up this info.</li>
            <li><span className="command">\dock [side]</span> docks the chat.</li>
            <li><span className="command">\float [side]</span> floats (undocks) the chat.</li>
            <li><span className="command">\clear [num]</span> deletes the top [num] messages from the chat.</li>
            <li><span className="command">\play</span> play the video.</li>
            <li><span className="command">\pause</span> pause the video.</li>
            <li><span className="command">\mute</span> mute or unmute the video.</li>
            <li><span className="command">\unmute</span> unmute the video.</li>
            <li><span className="command">\volume [change]</span> change volume to a number 0-100, "up", "down", "mute", or "unmute".</li>
            <li><span className="command">\seek [time]</span> seek to [time].</li>
            <li><span className="command">\skip [num]</span> skip ahead [num] seconds.</li>
            <li><span className="command">\fullscreen</span> toggle fullscreen.</li>
          </ul>
        </div>, {kind: "info"});
    }
    // \CLEAR
    else if (command == "clear") {
      if (argnum > 1) {
        const messages_number = this.state.messages.length;
        if (args[1] == "all") {
          this.state.messages = [];
          this.addMessage('Cleared '+args[1]+' of '+messages_number+' messages.', {kind: "success"});
        } else if (Number(args[1])) {
          this.state.messages.splice(0,Number(args[1]));
          this.addMessage('Cleared '+args[1]+' of '+messages_number+' messages.', {kind: "success"});
        } else {
          this.addMessage('Failed to clear messages. You must specify a number or "all".', {kind: "warning"});
        }
      } else {
        this.addMessage('Failed to clear messages. You must specify a number or "all".', {kind: "warning"});
      }
    }
    // \PLAY, \PAUSE, \MUTE, \UNMUTE, \VOLUME, \SEEK, \SKIP, \FULLSCREEN
    else if (command == "play") {
      document.getElementById('video').play();
      this.addMessage('Playing the video.', {kind: "success"});
    }
    else if (command == "pause") {
      document.getElementById('video').pause();
      this.addMessage('Pausing the video.', {kind: "success"});
    }
    else if (command == "mute") {
      document.getElementById('video').muted = !document.getElementById('video').muted;
      this.addMessage('Video '+(document.getElementById('video').muted ? '' : 'un')+'muted.', {kind: "success"});
    }
    else if (command == "unmute") {
      document.getElementById('video').muted = false;
      this.addMessage('Video unmuted.', {kind: "success"});
    }
    else if (command == "skip") {
      if (argnum > 1 && Number(args[1])) {
        document.getElementById('video').currentTime += Number(args[1]);
        if (Number(args[1]) > 0) {
          this.addMessage('Skipped forward '+Number(args[1])+' seconds.', {kind: "success"});
        }
        else if (Number(args[1]) < 0) {
          this.addMessage('Skipped back '+(-Number(args[1]))+' seconds.', {kind: "success"});
        }
      }
      else {
        this.addMessage('Failed to skip. Must provide a number of seconds.', {kind: "warning"});
      }
    }
    else if (command == "seek") {
      if (argnum > 1 && args[1].split(':').length==2 && Number(args[1].split(':')[0]) && Number(args[1].split(':')[1])) {
        document.getElementById('video').currentTime = 60*Number(args[1].split(':')[0])+Number(args[1].split(':')[1]);
        this.addMessage('Seeked to '+args[1]+'.', {kind: "success"});
      }
      else {
        this.addMessage('Failed to skip. Must provide a timestamp argument.', {kind: "warning"});
      }
    }
    else if (command == "volume") {
      const prev_volume = document.getElementById('video').volume;
      if (argnum > 1) {
        if (args[1] == "up") {
          document.getElementById('video').muted = false;
          document.getElementById('video').volume = Math.min(prev_volume+0.1,1);
          this.addMessage('Volume increased.', {kind: "success"});
        }
        else if (args[1] == "down") {
          document.getElementById('video').muted = false;
          document.getElementById('video').volume = Math.max(prev_volume-0.1,0);
          this.addMessage('Volume decreased.', {kind: "success"});
        }
        else if (args[1] == "mute") {
          document.getElementById('video').muted = true;
          this.addMessage('Volume muted.', {kind: "success"});
        }
        else if (args[1] == "unmute") {
          document.getElementById('video').muted = false;
          this.addMessage('Volume unmuted.', {kind: "success"});
        }
        else if (Number(args[1]) && 0<=Number(args[1]) && Number(args[1])<=100) {
          document.getElementById('video').muted = false;
          document.getElementById('video').volume = Number(args[1])/100;
          this.addMessage('Volume set to '+Number(args[1])+'.', {kind: "success"});
        }
        else {
          this.addMessage('Failed volume change. Must provide an argument.', {kind: "warning"});
        }
      }
    }
    else if (command == "fullscreen") {
      const elem = document.getElementById('root') || document.documentElement;
      if (!document.fullscreenElement && !document.mozFullScreenElement &&
        !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
      this.addMessage('Toggling fullscreen.', {kind: "success"});
    }
    // UNKNOWN COMMAND
    else {
      this.addMessage('Unknown command "'+composition+'".', {kind: "warning"});
    }
  }

  constructor(props) {
    super(props);

    setTimeout(() => {
      this.addMessage(<div>Type <span className="command">\?</span> for a list of commands.</div>, {kind: "info"});
    }, 0);

    this.props.socket.on("server:message", (message) => {
      this.addMessage(message);
    });

    this.props.socket.on("server:lobby-connected-users", (users) => {
      const state = Object.assign({}, this.state);
      state.users = users;
      this.setState(state, () => {
        this.addMessage(users + " total users are now connected.", {kind: "info"});
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
            if (e.key === "Enter" && this.state.composition.length > 0) {
              const state = Object.assign({}, this.state)
              const composition = this.state.composition;
              state.composition = "";
              this.setState(state, () => {
                // send the message if it is not a special command
                if (composition[0] != "\\") {
                  const message = model.state.user.username + ": " + composition;
                  this.addMessage(message);
                  this.props.socket.emit("client:message", message);
                } else { // do the command if it is known
                  this.chatCommand(composition);
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
