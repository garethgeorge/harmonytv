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

  commands = {}

  constructor(props) {
    super(props);

    this.messages = React.createRef();
    this.registerCommands();

    setTimeout(() => {
      this.addMessage(<div>Type <span className="command">\?</span> for a list of commands.</div>, { kind: "info" });
    }, 0);

    this.props.socket.on("server:message", (message) => {
      this.addMessage(message);
    });

    this.props.socket.on("server:lobby-connected-users", (users) => {
      const state = Object.assign({}, this.state);
      state.users = users;
      this.setState(state, () => {
        this.addMessage(users + " total users are now connected.", { kind: "info" });
      });
    });
  }

  registerCommand(command, handler, opts = null) {
    if (!opts)
      opts = []

    if (command instanceof Array) {
      for (const cmd of command) {
        this.registerCommand(cmd, handler);
      }
      return;
    }

    if (opts && opts.args) {
      opts.requiredArgs = 0;
      for (const arg of opts.args) {
        if (arg.optional != true) {
          opts.requiredArgs += 1;
        }
      }
    }

    if (opts && opts.requiredArgs) {
      const oldHandler = handler;
      handler = (args) => {
        if (args.length < opts.requiredArgs) {
          this.addMessage(
            `Expected ${opts.requiredArgs} arguments - usage: ` +
            opts.args.map((arg, idx) => "<" + (arg.name || "arg" + idx) + ">").join(', '),
            { kind: "warning" }
          );
          return;
        }
        oldHandler(args);
      }
    }

    this.commands[command] = {
      "command": command,
      "handler": handler,
      "opts": opts
    }
  }

  addMessage(messageText, opts = {}) {
    // const index = this.state.messages.length;
    const options = Object.assign({ kind: "message" }, opts);

    const state = Object.assign({}, this.state);
    var message = {
      key: this.state.messages.length,
      text: messageText,
      kind: options.kind,
      data: {
        classlist: []
      }
    };
    state.messages = this.state.messages.slice(0);
    state.messages.push(message);
    this.setState(state, () => {
      if (this.messages.current)
        this.messages.current.scrollTop = this.messages.current.scrollHeight + 1000;
    });

    setTimeout(() => {
      message.data.classlist.push('old');
      this.setState(this.state);
    }, 15000);

    return message;
  }

  chatCommand(composition) {
    const args = composition.split(' ');
    const argnum = args.length;
    const command = args[0].substr(1);

    if (!this.commands[command]) {
      this.addMessage('Unknown command "' + composition + '".', { kind: "warning" });
    } else {
      this.commands[command].handler(args.slice(1));
    }
  }

  registerCommands() {

    this.registerCommand("?", (args) => {
      const commands = Object.values(this.commands).map(command => {
        let text = null;
        if (!text && command.opts.help)
          text = command.opts.help
        let usage = null;
        if (!usage && command.opts.args) {
          usage = " usage: " + command.opts.args.map(arg => {
            if (arg.optional)
              return "[" + arg.name + "]"
            return "<" + arg.name + ">"
          }).join(" ");
        }

        return (
          <li><span className="command">{"\\" + command.command}</span> {text} {usage}</li>
        )
      });

      this.addMessage(
        <div>
          Commands:
          <ul className="command-list">
            {commands}
          </ul>
        </div>
        , { kind: "info" });
    });

    this.registerCommand("dock", (args) => {
      const stateCpy = Object.assign({}, this.state);
      stateCpy.docked = true;
      if (args.length > 0) {
        if (args[0] == "left" || args[0] == "right") {
          stateCpy.side = args[0];
        } else {
          this.addMessage("side must be one of \'left\' or \'right\'", { kind: "success" });
        }
      }
      this.setState(stateCpy, () => {
        this.addMessage(`Chatbox docked to side ${stateCpy.side}.`, { kind: "success" });
      });
    }, {
      help: "docks the chat",
      args: [
        {
          name: "side",
          optional: true
        }
      ]
    });

    this.registerCommand("float", (args) => {
      const stateCpy = Object.assign({}, this.state);
      stateCpy.docked = false;
      this.setState(stateCpy, () => {
        this.addMessage(`Undocked chatbox`, { kind: "success" });
      });
    }, {
      help: "undocks the chat"
    });

    this.registerCommand("clear", (args) => {
      const stateCpy = Object.assign({}, this.state);
      stateCpy.messages = [];
      this.setState(stateCpy);
    }, {
      help: "clears chat messages",
    });

    this.registerCommand("play", (args) => {
      document.getElementById('video').play(); // TODO: this is a very bad way of doing this by react conventions
      this.addMessage('Playing the video.', { kind: "success" });
    }, {
      help: "plays the video"
    });

    this.registerCommand("pause", (args) => {
      document.getElementById('video').pause(); // TODO: this is a very bad way of doing this by react conventions
      this.addMessage('Paused the video.', { kind: "success" });
    }, {
      help: "pauses the video"
    });

    this.registerCommand("toggle_audio", (args) => {
      document.getElementById('video').muted = !document.getElementById('video').muted;
      this.addMessage('Video ' + (document.getElementById('video').muted ? '' : 'un') + 'muted.', { kind: "success" });
    }, {
      help: "toggles audio on / off",
    });

    this.registerCommand("fullscreen", (args) => {
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
      this.addMessage('Toggling fullscreen.', { kind: "success" });
    });
  }

  render() {
    if (this.state.users <= 1)
      return (<div></div>);

    const messages = [];
    for (const message of this.state.messages) {
      messages.push(
        <span
          className={"chat-text " + message.kind + " " + message.data.classlist.join(" ")}
          key={message.key}
        >
          {message.text}
        </span>
      );
    }

    return (
      <div className={"chatbox " + (this.state.docked ? "docked " : "") + this.state.side}>
        <div className="messages" ref={this.messages}>{messages}</div>
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

              if (newState.state == "paused") {
                this.socket.emit("client:message", model.state.user.username + " paused the video");
              } else if (newState.state == "playing") {
                this.socket.emit("client:message", model.state.user.username + " played the video");
              }

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

    this.chatbox = <ChatBox socket={this.socket} />;

    return (
      <div className="lobbyview">
        <Player ref={this.player} />
        {this.chatbox}
      </div>
    );
  }
}

export default Lobby;
