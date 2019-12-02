import React from "react";
import { observer } from "mobx-react";
import "./chatbox.scss";
import model from "../../../model";
import chatboxCommands from "./chatbox_commands.jsx";
import uuidv4 from "uuid/v4";
import config from "../../../config";
import messageHandler from "./message_handler";
const debug = require("debug")("components:lobby:chatbox");

function randomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";
  for (var i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
  return color;
}

export default observer(
  class ChatBox extends React.Component {
    state = {
      composition: "",
      streams: [],
      users: 1,
      display: "docked",
      displayOptions: {
        side: "left",
        visibility: true
      }
    };

    persistentState = ["display", "displayOptions"];
    persistentVars = ["userColor"];
    userColor = randomColor();
    uniqueId = uuidv4();
    streamCount = 0;
    chatArea = React.createRef();
    textEntry = React.createRef();
    notes = [];
    userList = [];

    commandHistory = [];
    commandHistoryIndex = null;

    constructor(props) {
      super(props);
      document.addEventListener("keydown", e => {
        if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
          if (document.activeElement != this.textEntry.current) {
            this.textEntry.current.focus();
            e.preventDefault();
            e.stopPropagation();
          }
        }
      });

      chatboxCommands(this);
      messageHandler(this);

      setTimeout(() => {
        this.addMessage({
          metaData: {
            streamKind: "info-chunk",
            messageType: "info",
            group: "info",
          },
          content: {
            text: "type \\? for a list of commands",
          }
        });
      }, 0);

      this.props.socket.on("server:message", message => {
        this.receiveMessage(message);
      });

      this.props.socket.on("server:lobby-connected-users", users => {
        const state = Object.assign({}, this.state);
        state.users = users;
        this.setState(state);
        this.addMessage({
          metaData: {
            streamKind: "info-chunk",
            messageType: "conn-user-joined",
            messageKind: "info",
            group: "info",
          },
          content: {
            users: users,
          }
        });
      });
    }

    componentDidMount() {
      this.loadPreferences();
    }

    savePreferences() {
      let preferences = {state: {}, vars: {}};
      for (const pref of this.persistentState) {
        preferences.state[pref] = this.state[pref];
      }
      for (const pref of this.persistentVars) {
        preferences.vars[pref] = this[pref];
      }
      debug(JSON.stringify(preferences));
      window.localStorage.setItem(
        "harmonytv-chatbox",
        JSON.stringify(preferences)
      );
    }

    loadPreferences() {
      let state = Object.assign({}, this.state);
      try {
        let preferences = JSON.parse(
          window.localStorage.getItem("harmonytv-chatbox")
        );
        for (const pref in preferences.vars) {
          this[pref] = preferences.vars[pref];
        }
        for (const pref in preferences.state) {
          state[pref] = preferences.state[pref];
        }
      } finally {
        this.setState(state);
      }
    }

    openStream(kind, data = {}) {
      let state = Object.assign({}, this.state);
      const key = this.streamCount;
      this.streamCount++;
      debug("CALL open");
      this.setState(prevState => {
        let state = Object.assign({}, prevState);
        state.streams.push({
          lines: [],
          key: key,
          open: true,
          data: data,
          kind: kind
        });
        debug("OPEN");
        return state;
      });
      return key;
    }

    closeStream(streamIndex) {
      debug("CLOSING ", streamIndex, this.state.streams);
      this.setState(prevState => {
        let state = Object.assign({}, prevState);
        if (state.streams[streamIndex]) {
          state.streams[streamIndex].open = false;
        }
        return state;
      });
    }

    streamData(streamIndex, key = null, val = null) {
      if (key == null) {
        return this.state.streams[streamIndex].data;
      }
      if (val == null) {
        return this.state.streams[streamIndex].data[key];
      } else {
        this.setState(prevState => {
          let state = Object.assign({}, prevState);
          state.streams[streamIndex].data[key] = val;
          return state;
        });
      }
    }

    stream(streamIndex) {
      return this.state.streams[streamIndex];
    }

    print(streamIndex, line, time = 17000) {
      // line = {kind: kind, content: content};
      if (streamIndex == null) {
        debug("tried to print to nonexistent stream.");
        return ;
      }
      line = Object.assign({ kind: "normal", classlist: [] }, line);
      this.setState(
        prevState => {
          let state = Object.assign({}, prevState);
          if (state.streams[streamIndex] && state.streams[streamIndex].open) {
            let k = state.streams[streamIndex].lines.length;
            state.streams[streamIndex].lines.push(line);
            setTimeout(() => {
              this.setState(prevState2 => {
                let newstate = Object.assign({}, prevState2);
                if (newstate.streams[streamIndex]) {
                  newstate.streams[streamIndex].lines[k].classlist.push("old");
                }
                return newstate;
              });
            }, time);
          } else {
            debug("tried to print to closed stream.");
          }
          return state;
        },
        () => {
          if (this.chatArea.current)
            this.chatArea.current.scrollTop =
              this.chatArea.current.scrollHeight + 1000;
        }
      );
    }

    execCommand(composition) {
      const command = composition.split(" ")[0].substr(1);
      const argstr = (composition + " ")
        .split(" ")
        .slice(1)
        .join(" ");
      if (!this.commands[command]) {
        let streamIndex = this.openStream("command-box");
        this.print(streamIndex, {
          content: composition,
          kind: "command-entered"
        });
        this.print(streamIndex, {
          content: (
            <span>
              Unknown command <span className="command">\{command}</span>.
            </span>
          ),
          kind: "error"
        });
        this.closeStream(streamIndex);
      } else {
        let streamIndex = null;
        if (!this.commands[command].opts.noOutput) {
          streamIndex = this.openStream("command-box");
          this.print(streamIndex, {
            content: composition,
            kind: "command-entered"
          });
        }
        this.commands[command].handler(argstr, streamIndex);
        if (!this.commands[command].opts.noOutput || !this.commands[command].opts.keepStreamOpen) {
          this.closeStream(streamIndex);
        }
      }
    }

    render() {
      if (!config.development) {
        if (this.state.users <= 1) return null;
      }

      return (
        <div
          className={"chatbox"}
          display={this.state.display}
          display-side={this.state.displayOptions.side}
          display-visibility={this.state.displayOptions.visibility.toString()}
        >
          <div className="chat-area" ref={this.chatArea}>
            {this.state.streams.map(stream => (
              <div
                className={
                  "chat-stream " +
                  (stream.lines
                    .map(line => line.classlist.includes("old"))
                    .includes(false)
                    ? ""
                    : "old")
                }
                open={stream.open ? true : false}
                kind={stream.kind}
                key={stream.key}
              >
                {stream.lines.map(line => (
                  <div
                    className={"stream-line " + line.classlist.join(" ")}
                    kind={line.kind}
                    key={line.key}
                  >
                    {line.content}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* this is the actual text input */}
          <textarea
            ref={this.textEntry}
            className={
              "chatbox-text-entry " +
              (this.state.composition[0] == "\\" ? "command" : "")
            }
            type="text"
            value={this.state.composition}
            onInput={e => {
              const state = Object.assign({}, this.state);
              //console.log('comp: ', this.textEntry.current);
              const textArea = this.textEntry.current;
              textArea.style.height = 0;
              textArea.style.overflowY = "hidden";
              textArea.style.height = "calc(" + (textArea.scrollHeight) + "px + 2px)";
              textArea.style.overflowY = "auto";
              state.composition = textArea.value;//e.target.value;
              this.setState(state);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (this.state.composition.length > 0) {
                  const state = Object.assign({}, this.state);
                  const composition = this.state.composition;
                  state.composition = "";
                  this.setState(state, () => {
                    const textArea = this.textEntry.current;
                    textArea.style.height = 0;
                    textArea.style.height = (textArea.scrollHeight + 2) + "px";
                    // send the message if it is not a special command
                    if (composition[0] != "\\") {
                      this.sendMessage({
                        metaData: {
                          streamKind: "user-chunk",
                          messageType: "user-message",
                        },
                        content: {
                          text: composition,
                          userColor: this.userColor,
                        }
                      });
                    } else {
                      // do the command if it is known
                      this.execCommand(composition);
                    }
                  });
                } else {
                  if (this.state.display !== "docked") {
                    this.textEntry.current.blur();
                  }
                }
              }
            }}
          >Type Here</textarea>
        </div>
      );
    }
  }
);

// <input
//   ref={this.textEntry}
//   className={
//     "chatbox-text-entry " +
//     (this.state.composition[0] == "\\" ? "command" : "")
//   }
//   type="text"
//   value={this.state.composition}
//   onChange={e => {
//     const state = Object.assign({}, this.state);
//     state.composition = e.target.value;
//     this.setState(state);
//   }}
//   onKeyDown={e => {
//     if (e.key === "Enter") {
//       if (this.state.composition.length > 0) {
//         const state = Object.assign({}, this.state);
//         const composition = this.state.composition;
//         state.composition = "";
//         this.setState(state, () => {
//           // send the message if it is not a special command
//           if (composition[0] != "\\") {
//             this.sendMessage({
//               metaData: {
//                 streamKind: "user-chunk",
//                 messageType: "user-message",
//               },
//               content: {
//                 text: composition,
//                 userColor: this.userColor,
//               }
//             });
//           } else {
//             // do the command if it is known
//             this.execCommand(composition);
//           }
//         });
//       } else {
//         if (this.state.display !== "docked") {
//           this.textEntry.current.blur();
//         }
//       }
//     }
//   }}
// />
