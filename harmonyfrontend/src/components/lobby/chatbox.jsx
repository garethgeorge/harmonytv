import React from "react";
import { observer } from "mobx-react";
import "./chatbox.scss";
import model from "../../model";
import chatboxCommands from "./chatbox_commands.jsx";

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
    messages: [],
    users: 1,
    docked: true,
    side: "left",
    userColor: randomColor(),
  }

  persistent = ["docked", "side", "userColor"]

  commands = {}

  commandBox = []

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
      console.log(e);
      console.log(document.activeElement, this.textEntry.current)
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

    this.messages = React.createRef();
    chatboxCommands(this);

    this.addMessage(<div>Type <span className="command">\?</span> for a list of commands.</div>, { kind: "info" });

    this.props.socket.on("server:message", (message) => {
      this.receiveRelayMessage(message);
    });

    this.props.socket.on("server:lobby-connected-users", (users) => {
      const state = Object.assign({}, this.state);
      state.users = users;
      this.setState(state, () => {
        this.addMessage(users + " total users are now connected.", { kind: "info" });
      });
    });

    this.sendRelayMessage({version: "1", type: "user-joined", sender: model.state.user.username, color: this.userColor});
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
    let argHandler = (argstr) => {
      if (opts && opts.args) {
        const validArgStr = /^\s*(?:(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*(?:[A-Za-z]\w*=(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*$/;
        if (!(argstr+' ').match(validArgStr)) {
          // if argstr is invalid, throw error.
          this.printFlush(
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
                  this.printFlush(
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
            this.printFlush(
              <span>More arguments supplied than expected. Expected usage: <br/><span className="command">{usage}</span>.</span>,
              { kind: "error" }
            );
            return ;
          }
          let values = {};
          for (const arg of opts.args) {
            if (prevalues[arg.name]) {
              if (arg.validate && !arg.validate.test(prevalues[arg.name])) {
                console.log('tested');
                this.printFlush(
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
          console.log(values);
          oldHandler(values);
          this.flushCommand();
          return ;
        }
      }
      oldHandler(argstr);
      this.flushCommand();
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

  print(messageText, opts = {}) {
    var line = {
      key: this.commandBox.length,
      text: messageText,
      kind: (opts.kind ? opts.kind : 'normal'),
      data: {
        classlist: []
      }
    };
    this.commandBox.push(line);
  }

  printFlush(messageText, opts = {}) {
    this.print(messageText, opts);
    this.flushCommand();
  }

  flushCommand() {
    // setTimeout so that multiple messages can be added at the same time.
    if (this.commandBox.length == 0) {
      return ;
    }
    const lines = [];
    for (const line of this.commandBox) {
      lines.push(
        <span
          className={"chat-text " + line.kind + " " + line.data.classlist.join(" ")}
          key={line.key}
        >
          {line.text}
        </span>
      );
    }
    this.addMessage(<div className="command-box">{lines}</div>);
    this.commandBox.length = 0;
    let state = Object.assign({}, this.state);
    // this.setState(state);
  }

  addMessage(messageText, opts = {}) {
    // setTimeout so that multiple messages can be added at the same time.
    setTimeout(() => {
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
    }, 0);
  }

  sendRelayMessage(relayMessage) {
    const message = JSON.stringify(relayMessage);
    this.props.socket.emit("client:message", message);
    this.receiveRelayMessage(message, true);
  }

  receiveRelayMessage(relayMessage, mine=false) {
    const message = JSON.parse(relayMessage);
    if (message.version != "1") {
      this.addMessage('Your version is out of date.', {kind: 'warning'});
    }
    if (message.type == "user-message") {
      this.addMessage(<span className={"user-message " + (mine ? "my-message" : "")}><span className="message-sender" style={{color: message.color}}>{message.sender}:</span> <span className="message-content">{message.text}</span></span>);
    }
    if (message.type == "user-joined") {
      this.addMessage(<span className="user-joined"><span className="message-sender" style={{color: message.color}}>{message.sender}</span> joined the lobby.</span>, {kind: 'info'});
    }
  }

  makeMessage (composition) {
    return {
      version: "1",
      type: 'user-message',
      sender: model.state.user.username,
      text: composition,
      color: this.state.userColor,
    }
  }

  execCommand(composition) {
    const command = composition.split(' ')[0].substr(1);
    const argstr = (composition+' ').split(' ').slice(1).join(' ');

    this.print(composition, { kind: "command-entered" });
    this.commandHistory.push(composition);
    this.commandHistory = this.commandHistory.filter((item,pos,arr) => {
      return pos === 0 || item !== arr[pos-1]; // remove consecutive duplicates
    })
    this.commandHistoryIndex = null;
    console.log(this.commandHistory);
    if (!this.commands[command]) {
      this.printFlush(<span>Unknown command <span className="command">\{command}</span>.</span>, { kind: "error" });
    } else {
      this.commands[command].handler(argstr);
    }
  }

  render() {
    // if (this.state.users <= 1)
    //   return null;

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
                    const message = this.makeMessage(composition);
                    this.sendRelayMessage(message);
                  } else { // do the command if it is known
                    this.execCommand(composition);
                  }
                });
              } else {
                if (!this.state.docked) {
                  this.textEntry.current.blur();
                }
              }
            }
          }} />
      </div>
    )
  }
});
