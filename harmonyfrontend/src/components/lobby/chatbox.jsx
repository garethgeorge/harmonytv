import React from "react";
import { observer } from "mobx-react";
import "./chatbox.scss";
import model from "../../model";
import Cookie from "universal-cookie";
const cookies = new Cookie();

export default observer(class ChatBox extends React.Component {
  state = {
    composition: "",
    messages: [],
    users: 1,
    docked: true,
    side: "left",
  }

  commands = {}

  constructor(props) {
    super(props);

    const docked = cookies.get("harmonytv-chatbox-docked");
    if (docked) {
      this.state.docked = true;
    } else
      this.state.docked = false;

    const side = cookies.get("harmonytv-chatbox-side");
    if (side === "left" || side === "right") {
      this.state.side = side;
    }

    this.textEntry = React.createRef();
    document.addEventListener('keydown', (e) => {
      if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
        if (document.activeElement != this.textEntry) {
          this.textEntry.current.focus();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });
    // document.addEventListener('keyup', (e) => {
    //   if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
    //     if (document.activeElement != this.textEntry) {
    //       this.textEntry.current.focus();
    //       e.preventDefault();
    //       e.stopPropagation();
    //     }
    //   }
    // });

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
          return <span className="command-arg optional">{"["+arg.name+"]"}</span>;
        }
        return <span className="command-arg">{"<"+arg.name+">"}</span>;
      });
    }
    const usage = <span className="command">{"\\" + command}{arglist ? " " : ""}{arglist}</span>;

    // Determine number of required args
    // if (opts && opts.args) {
    //   opts.requiredArgs = 0;
    //   for (const arg of opts.args) {
    //     if (arg.optional != true) {
    //       opts.requiredArgs += 1;
    //     }
    //   }
    // }
    //
    // // Allow named reference to args
    // let oldHandler = handler;
    // const argHandler = (args) => {
    //   let newArgs = {pos, kw};
    //   for (let i in args) {
    //     newArgs.pos[i] = args[i];
    //   }
    //   for (let i in opts.args) {
    //     newArgs.kw[opts.args[i].name] = args[i];
    //   }
    //   newArgs.count = args.length;
    //   oldHandler(newArgs);
    // }
    //
    // // Preliminary error checking on number of required args
    // let countHandler = argHandler;
    // if (opts && opts.requiredArgs) {
    //   countHandler = (args) => {
    //     if (args.length < opts.requiredArgs) {
    //       this.addMessage(
    //         <span>Expected {opts.requiredArgs} argument(s). Usage: <br/> {usage}</span>,
    //         { kind: "warning" }
    //       );
    //       return;
    //     }
    //     argHandler(args);
    //   }
    //

    // Validate and parse argstr
    let oldHandler = handler;
    let argHandler;
    if (opts && opts.args) {
      argHandler = (argstr) => {
        const validArgStr = /^\s*(?:(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*(?:[A-Za-z]\w*=(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*$/;
        if (!(argstr+' ').match(validArgStr)) {
          // if argstr is invalid, throw error.
          this.addMessage(
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
          // get positional an keyword args
          for (const argtext of splitArgs) {
            const argParts = Array.from(argtext.matchAll(argPartSplitter), m => m[0]);
            if (argParts.length == 1) {
              posargsParsed = argParts[0];
            } else {
              kwargsParsed[argParts[0]] = argParts[1];
            }
          }
          // figure out which arguments are which...
          let prevalues = Object.assign({},kwargsParsed);
          let req = 0;
          for (const arg of opts.args) {
            if (!hasOwnProperty.call(prevalues, arg.name)) {
              prevalues[arg.name] = null;
              if (!arg.optional) {
                req ++;
              }
            }
          }
          let free = posargsParsed.length - req; // number of optional ones to fill.
          let i = 0;
          for (const arg of opts.args) {
            if (prevalues[arg.name] == null) {
              if (!arg.optional) {
                if (i < posargsParsed.length) {
                  prevalues[arg.name] = posargsParsed[i];
                  i ++;
                } else {
                  this.addMessage(
                    <span>Not all required arguments supplied. Expected usage: <br/><span className="command">{usage}</span>.</span>,
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
            this.addMessage(
              <span>More arguments supplied than expected. Expected usage: <br/><span className="command">{usage}</span>.</span>,
              { kind: "error" }
            );
            return ;
          }
          let values = {};
          for (const arg of opts.args) {
            if (prevalues[arg.name]) {
              if (arg.validate && !arg.validate.test(prevalues[arg.name])) {
                this.addMessage(
                  <span>Invalid format for <span className="command command-arg">{arg.name}</span> argument.</span>,
                  { kind: "error" }
                );
                return ;
              } else {
                if (arg.parse) {
                  values[arg.name] = arg.parse(prevalues[arg.name]);
                } else {
                  values[arg.name] = prevalues[arg.name];
                }
              }
            }
          }
          oldHandler(values);
        }
      }
    }

    handler = argHandler;

    this.commands[command] = {
      "command": command,
      "handler": handler,
      "opts": opts,
      "usage": usage,
    }
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

  chatCommand(composition) {
    const command = composition.split(' ')[0].substr(1);
    const argstr = composition.split(' ',1)[1];

    if (!this.commands[command]) {
      this.addMessage(<span>Unknown command <span className="command">{composition}</span>.</span>, { kind: "warning" });
    } else {
      this.commands[command].handler(argstr);
    }
  }

  registerCommands() {

    this.registerCommand("?", (args) => {
      const commands = Object.values(this.commands).map(command => {
        if (command.opts.secret) {
          return ;
        }
        let text = null;
        if (!text && command.opts.help)
          text = command.opts.help

        return (
          <li>{command.usage} {text}</li>
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
    }, {
      help: 'show this list'
    });

    this.registerCommand("test", (args) => {
      this.addMessage("this is a test.", { kind: "info" });
    }, {
      help: 'test stuff',
      args: [
        {
          name: 'foo',
          optional: false,
        },
        {
          name: 'bar',
          optional: true,
        },
        {
          name: 'xyz',
          optional: false,
        },
      ]
    });

    this.registerCommand("dock", (args) => {
      const stateCpy = Object.assign({}, this.state);
      stateCpy.docked = true;
      cookies.set("harmonytv-chatbox-docked", stateCpy.docked);
      console.log(args);
      if (args.length > 0) {
        if (args[0] == "left" || args[0] == "right") {
          cookies.set("harmonytv-chatbox-side", args[0]);
          stateCpy.side = args[0];
        } else {
          this.addMessage("side must be one of \'left\' or \'right\'", { kind: "success" });
        }
      }
      this.setState(stateCpy, () => {
        this.addMessage(`Chatbox docked to ${stateCpy.side} side.`, { kind: "success" });
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

    this.registerCommand(["float", "undock"], (args) => {
      const stateCpy = Object.assign({}, this.state);
      stateCpy.docked = false;
      cookies.set("harmonytv-chatbox-docked", stateCpy.docked);
      if (args.length > 0) {
        if (args[0] == "left" || args[0] == "right") {
          cookies.set("harmonytv-chatbox-side", args[0]);
          stateCpy.side = args[0];
        } else {
          this.addMessage("side must be one of \'left\' or \'right\'", { kind: "success" });
        }
      }
      this.setState(stateCpy, () => {
        this.addMessage(`Chatbox undocked to ${stateCpy.side} side.`, { kind: "success" });
      });
    }, {
      help: "undocks the chat",
      args: [
        {
          name: "side",
          optional: true
        }
      ]
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

    this.registerCommand("skip", (args) => {
      if (Number(args[0])) {
        document.getElementById('video').currentTime += Number(args[0]);
        if (Number(args[0]) > 0) {
          this.addMessage('Skipped forward '+Number(args[0])+' seconds.', {kind: "success"});
        }
        else if (Number(args[0]) < 0) {
          this.addMessage('Skipped back '+(-Number(args[0]))+' seconds.', {kind: "success"});
        }
        else {
          this.addMessage('Failed to skip. Must provide a number of seconds.', {kind: "warning"});
        }
      }
    }, {
      help: "skip forward by seconds",
      args: [{
        name: "seconds",
        optional: false
      }]
    });

    this.registerCommand("seek", (args) => {
      document.getElementById('video').currentTime = args.time;
      this.addMessage('Seeked to '+args[0]+'.', {kind: "success"});

      // if (args[0].split(':').length==2 && Number(args[0].split(':')[0]) && Number(args[0].split(':')[1])) {
      //   document.getElementById('video').currentTime = 60*Number(args[0].split(':')[0])+Number(args[0].split(':')[1]);
      //   this.addMessage('Seeked to '+args[0]+'.', {kind: "success"});
      // }
      // else {
      //   this.addMessage('Failed to seek. Must provide a timestamp argument.', {kind: "warning"});
      // }
    }, {
      help: "seek to a timestamp",
      args: [{
        name: "time",
        optional: false,
        validate: /^\d+:[0-5]\d(:[0-5]\d)?(.\d+)?$/,
        parse: (timestamp) => {const parts = timestamp.split(':'); return {seconds: parts.length == 2 ? 60*parts[0]+parts[1] : 60*60*parts[0] + 60*parts[1] + parts[0], timestamp: timestamp};}
      }]
    });

    this.registerCommand("volume", (args) => {
      const prev_volume = document.getElementById('video').volume;
      const arg = args.change;
      if (arg == "up") {
        document.getElementById('video').muted = false;
        document.getElementById('video').volume = Math.min(prev_volume+0.2,1);
        this.addMessage('Volume increased.', {kind: "success"});
      }
      else if (arg == "down") {
        document.getElementById('video').muted = false;
        document.getElementById('video').volume = Math.max(prev_volume-0.2,0);
        this.addMessage('Volume decreased.', {kind: "success"});
      }
      else if (arg == "mute") {
        document.getElementById('video').muted = true;
        this.addMessage('Volume muted.', {kind: "success"});
      }
      else if (arg == "unmute") {
        document.getElementById('video').muted = false;
        this.addMessage('Volume unmuted.', {kind: "success"});
      }
      else if (Number(arg) && 0<=Number(arg) && Number(arg)<=100) {
        document.getElementById('video').muted = false;
        document.getElementById('video').volume = Number(arg)/100;
        this.addMessage('Volume set to '+Number(arg)+'.', {kind: "success"});
      }
      else {
        this.addMessage('change must be one of \'up\', \'down\', \'mute\', \'unmute\' or a number 0-100.', {kind: "warning"});
      }
    }, {
      help: "change volume (up, down, mute, unmute, 0-100)",
      args: [
        {
          name: "change",
          optional: false
        }
      ]
    });

    this.registerCommand("mute", (args) => {
      document.getElementById('video').muted = true;
      this.addMessage('Video muted.', { kind: "success" });
    }, {
      secret: true,
      help: "mutes the video",
    });

    this.registerCommand("unmute", (args) => {
      document.getElementById('video').muted = false;
      if (document.getElementById('video').volume < 0.2) {
        document.getElementById('video').volume = 0.2;
      }
      this.addMessage('Video unmuted.', { kind: "success" });
    }, {
      secret: true,
      help: "unmutes the video",
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
    }, {
      help: "toggle fullscreen"
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
        <input ref={this.textEntry} className={"chatboxTextEntry " + (this.state.composition[0]=="\\" ? "command" : "")} type="text"
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
                    const message = model.state.user.username + ": " + composition;
                    this.addMessage(message);
                    this.props.socket.emit("client:message", message);
                  } else { // do the command if it is known
                    this.chatCommand(composition);
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
