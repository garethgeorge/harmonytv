import React from "react";
import { observer } from "mobx-react";
import "./chatbox.scss";
import model from "../../model";
import chatboxCommands from "./chatbox_commands.jsx";
import ChatStream from "./chatbox_stream.jsx";

function randomColor() {
    var letters = "0123456789ABCDEF";
    var color = '#';
    for (var i = 0; i < 6; i++)
       color += letters[(Math.floor(Math.random() * 16))];
    return color;
}

export default observer(class ChatBox extends React.Component {
  state = {
    composition: "",
    streams: [],
    users: 1,
    display: "docked",
    displaySide: "left",
    userColor: randomColor(),
  }

  streamCount = 0;
  messageStream = null;

  persistent = ["display", "displaySide", "userColor"]

  commands = {}

  commandHistory = []
  commandHistoryIndex = null

  constructor(props) {
    super(props);

    this.loadPreferences();

    this.textEntry = React.createRef();

    document.addEventListener('keydown', (e) => {
      if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
        if (document.activeElement != this.textEntry.current) {
          this.textEntry.current.focus();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (document.activeElement == this.textEntry.current) {
        if (e.key === "ArrowUp" && !(e.ctrlKey || e.metaKey) && this.commandHistory.length) {
          console.log('up');
          let state = Object.assign({}, this.state);
          if (this.commandHistoryIndex == null) {
            this.commandHistoryIndex = this.commandHistory.length;
          }
          if (this.commandHistoryIndex > 0) {
            this.commandHistoryIndex -= 1;
          }
          state.composition = this.commandHistory[this.commandHistoryIndex];
          this.setState(state);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (document.activeElement == this.textEntry.current) {
        if (e.key === "ArrowDown" && !(e.ctrlKey || e.metaKey) && this.commandHistory.length && this.commandHistoryIndex !== null) {
          console.log('down');
          let state = Object.assign({}, this.state);
          if (this.commandHistoryIndex < this.commandHistory.length) {
            this.commandHistoryIndex += 1;
            state.composition = this.commandHistory[this.commandHistoryIndex];
          }
          if (this.commandHistoryIndex == this.commandHistory.length) {
            this.commandHistoryIndex = null;
            state.composition = '';
          }
          this.setState(state);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    //this.messages = React.createRef();
    chatboxCommands(this);

    //this.addMessage(<div>Type <span className="command">\?</span> for a list of commands.</div>, { kind: "info" });
    //this.receiveRelayMessage(this.makeInfoMessage("Type \"\\?\" for a list of commands."));

    // this.props.socket.on("server:message", (message) => {
    //   this.receiveRelayMessage(message);
    // });
    //
    // this.props.socket.on("server:lobby-connected-users", (users) => {
    //   const state = Object.assign({}, this.state);
    //   state.users = users;
    //   this.setState(state, () => {
    //     this.receiveRelayMessage(this.makeInfoMessage(users + " total users are now connected."));
    //   });
    // });

    // setTimeout(() => {
    //   this.sendRelayMessage(this.makeInfoMessage(model.state.user.username + ' joined the lobby.'));
    // }, 100);
  }

  componentDidUpdate() {
    this.savePreferences();
  }

  savePreferences() {
    let preferences = {};
    for (const pref of this.persistent) {
      preferences[pref] = this.state[pref];
    }
    window.localStorage.setItem("harmonytv-chatbox", JSON.stringify(preferences));
  }

  loadPreferences() {
    let state = Object.assign({}, this.state);
    let preferences = JSON.parse(window.localStorage.getItem("harmonytv-chatbox"));
    for (const pref in preferences) {
      state[pref] = preferences[pref];
    }
    this.setState(state);
  }

  registerCommand(command, handler, opts = null) {
    if (!opts)
      opts = {};

    // if an array is passed, apply the handler to each element
    if (command instanceof Array) {
      for (const cmd of command) {
        this.registerCommand(cmd, handler, opts);
      }
      return;
    }

    // generate html for command usage
    let arglist = null;
    if (!arglist && opts.args) {
      arglist = opts.args.map(arg => {
        if (arg.optional) {
          return <span className="command-arg optional">{" ["+arg.name+"]"}</span>;
        }
        return <span className="command-arg">{" <"+arg.name+">"}</span>;
      });
    }
    const usage = <span className="command">{"\\" + command}{arglist}</span>;

    // Validate and parse argstr
    let oldHandler = handler;
    let argHandler = (argstr,stream) => {
      let values = {};
      if (opts && opts.args) {
        const validArgStr = /^\s*(?:(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*(?:[A-Za-z]\w*=(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*$/;
        if (!(argstr+' ').match(validArgStr)) {
          // if argstr is invalid, throw error.
          stream.print(
            <span>Invalid argument string <span className="command">{argstr}</span>.</span>,
            { kind: "error" }
          );
          return ;
        } else {
          // if argstr is valid...
          const argSplitter = /(?<=^|\s)((?:[A-Za-z]\w*=)?(?:(?:[^\s="]|\\=)+|".*(?<!\\)"|""))(?=\s|$)/g;
          const splitArgs = Array.from(argstr.matchAll(argSplitter), m => m[0]);
          const argPartSplitter = /^([A-Za-z]\w*(?==))|((?:[^\s="]|\\=)+|".*(?<!\\)"|"")$/g;
          let kwargsParsed = {};
          let posargsParsed = [];
          // get positional and keyword args
          for (const argtext of splitArgs) {
            const argParts = Array.from(argtext.matchAll(argPartSplitter), m => m[0]);
            if (argParts.length == 1) {
              posargsParsed.push(argParts[0]);
            } else {
              kwargsParsed[argParts[0]] = argParts[1];
            }
          }
          // figure out which arguments are which...
          let prevalues = Object.assign({},kwargsParsed);
          let req = 0;
          for (const arg of opts.args) {
            if (!prevalues.hasOwnProperty(arg.name)) {
              prevalues[arg.name] = null;
              if (!arg.optional) {
                req ++;
              }
            }
          }
          let free = posargsParsed.length - req; // parseInt of optional ones to fill.
          let i = 0;
          for (const arg of opts.args) {
            if (prevalues[arg.name] == null) {
              if (!arg.optional) {
                if (i < posargsParsed.length) {
                  prevalues[arg.name] = posargsParsed[i];
                  i ++;
                } else {
                  stream.print(
                    <span>Not all required arguments supplied. Expected usage: <br/>{usage}.</span>,
                    { kind: "error" }
                  );
                  return ;
                }
              } else if (free > 0) {
                prevalues[arg.name] = posargsParsed[i];
                i ++;
                free-=1;
              }
            }
          }
          if (i < posargsParsed.length) {
            stream.print(
              <span>More arguments supplied than expected. Expected usage: <br/><span className="command">{usage}</span>.</span>,
              { kind: "error" }
            );
            return ;
          }
          for (const arg of opts.args) {
            if (prevalues[arg.name]) {
              if (arg.validate && !arg.validate.test(prevalues[arg.name])) {
                console.log('tested');
                stream.print(
                  <span>Invalid format for <span className="command command-arg">{arg.name}</span> argument.</span>,
                  { kind: "error" }
                );
                return ;
              } else {
                if (prevalues[arg.name][0] == '"') {
                  prevalues[arg.name] = prevalues[arg.name].slice(1,-1);
                }
                if (arg.parse) {
                  values[arg.name] = arg.parse(prevalues[arg.name]);
                } else {
                  values[arg.name] = prevalues[arg.name];
                }
              }
            } else {
              values[arg.name] = arg.hasOwnProperty('fallback') ? arg.fallback : null;
            }
          }
        }
      } else {
        values = argstr;
      }
      console.log('VALUES',values);
      oldHandler(values,stream);
      if (opts && !opts.keepStreamOpen) {
        this.closeStream(stream);
      }
      return ;
    }

    handler = argHandler;

    this.commands[command] = {
      "command": command,
      "handler": handler,
      "opts": opts,
      "usage": usage,
    }
  }

  openStream(kind) {
    let state = Object.assign({}, this.state);
    const key = this.streamCount;
    this.streamCount ++;
    console.log('CALL open');
    this.setState(prevState => {
      let state = Object.assign({}, prevState);
      state.streams.push({
        lines: [],
        kind: kind,
        key: key,
        open: true,
        data: {},
      });
      console.log('OPEN');
      return state;
    });
    return key;
  }

  closeStream(streamIndex) {
    this.setState(prevState => {
      let state = Object.assign({}, prevState);
      state.streams[streamIndex].open = false;
      return state;
    });
  }

  streamData(streamIndex, key, val=null) {
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

  print(streamIndex, line) {
    // line = {kind: kind, content: content};
    this.setState(prevState => {
      let state = Object.assign({}, prevState);
      console.log(state);
      if (state.streams[streamIndex].open) {
        state.streams[streamIndex].lines.push(line);
      } else {
        console.log('tried to print to closed stream.');
      }
      return state;
    });
  }


  sendRelayMessage(relayMessage) {
    this.props.socket.emit("client:message", relayMessage);
    this.receiveRelayMessage(relayMessage, {mine: true});
  }

  receiveRelayMessage(relayMessage, options={mine: false}) {
    const message = JSON.parse(relayMessage);
    if (!["1","2"].includes(message.version)) {
      this.addMessage('Your version is out of date.', {kind: 'warning'});
    }
    if (message.type == "user-message") {
      if ( this.messageStream === null
        || this.messageStream < this.streamCount-1
        || (this.stream(this.messageStream).kind != 'user-chunk')
        || (message.sender != this.streamData(this.messageStream, 'sender'))) {
        this.messageStream = this.openStream('user-chunk');
        this.streamData(this.messageStream, 'sender', message.sender);
      }
      console.log(this.messageStream);
      this.print(this.messageStream, {
        content:
          <span className={"user-message " +
                          (options.mine ? "my-message " : "")}>
            <span className="message-sender" style={{color: message.color}}>{message.sender}:</span>
            <span className="message-content">{message.text}</span>
          </span>,
        kind: 'message'
      });
    }
    if (message.type == "info-message") {
      console.log('HERE', this.messageStream, message);
      if ( this.messageStream === null
        || this.messageStream < this.streamCount-1
        || (this.stream(this.messageStream).kind != 'info-chunk')) {
        this.messageStream = this.openStream('info-chunk');
      }
      console.log(this.messageStream);
      this.print(this.messageStream, {
        content:
          <span className="info-message">
            <span className="message-content">{message.text}</span>
          </span>,
        kind: 'info'
      });
    }
  }

  makeUserMessage (composition) {
    return JSON.stringify({
      version: "2",
      type: 'user-message',
      sender: model.state.user.username,
      text: composition,
      color: this.state.userColor,
    });
  }

  makeInfoMessage (composition) {
    return JSON.stringify({
      version: "2",
      type: 'info-message',
      text: composition,
    });
  }

  execCommand(composition) {
    const command = composition.split(' ')[0].substr(1);
    const argstr = (composition+' ').split(' ').slice(1).join(' ');
    let streamIndex = this.openStream('command-box');
    console.log(streamIndex);
    this.print(streamIndex, {content: composition, kind: 'command-entered'});
    this.commandHistory.push(composition);
    this.commandHistory = this.commandHistory.filter((item,pos,arr) => {
      return pos === 0 || item !== arr[pos-1]; // remove consecutive duplicates
    })
    this.commandHistoryIndex = null;
    if (!this.commands[command]) {
      this.print(streamIndex, {
        content: <span>Unknown command <span className="command">\{command}</span>.</span>,
        kind: 'error'
      });
    } else {
      console.log('starting');
      console.log(this.commands);
      console.log(command);
      this.commands[command].handler(argstr,streamIndex);
      console.log('done');
    }
    //this.closeStream(streamIndex);
  }

  render() {
    return (
      <div className={"chatbox"} display={this.state.display} display-side={this.state.displaySide}>
        <div className="chat-area" ref={this.streams}>
          {this.state.streams.map(stream =>
            <div class="chat-stream" kind={stream.kind}>
              {stream.lines.map(line => <div class="stream-line" kind={line.kind}>{line.content}</div>)}
            </div>
          )}
        </div>
        {/* functionally this is padding */}
        {/* <div style={{ height: "30px", color: "red" }}></div> */}
        {/* this is the actual text input */}
        <input ref={this.textEntry} className={"chatboxTextEntry " + (this.state.composition[0] == "\\" ? "command" : "")} type="text"
          value={this.state.composition}
          onChange={(e) => {
            const state = Object.assign({}, this.state);
            state.composition = e.target.value;
            this.setState(state);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (this.state.composition.length > 0) {
                const state = Object.assign({}, this.state)
                const composition = this.state.composition;
                state.composition = "";
                this.setState(state, () => {
                  // send the message if it is not a special command
                  if (composition[0] != "\\") {
                    // const message = this.makeMessage(composition);
                    // this.sendRelayMessage(message);
                  } else { // do the command if it is known
                    this.execCommand(composition);
                  }
                });
              } else {
                if (!this.state.display == "docked") {
                  this.textEntry.current.blur();
                }
              }
            }
          }} />
      </div>
    )
  }
});
