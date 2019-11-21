import React from "react";
import { observer } from "mobx-react";
import "./chatbox.scss";
import model from "../../model";
import chatboxCommands from "./chatbox_commands.jsx";
// import ChatChunk from "./chatbox_chunk.jsx";

function randomColor() {
    var letters = "0123456789ABCDEF";
    var color = '#';
    for (var i = 0; i < 6; i++)
       color += letters[(Math.floor(Math.random() * 16))];
    return color;
}

function randomId() {
    var letters = "0123456789ABCDEF";
    var id = 'id_';
    for (var i = 0; i < 32; i++)
       id += letters[(Math.floor(Math.random() * 16))];
    return id;
}

export default observer(class ChatBox extends React.Component {
  state = {
    composition: "",
    streams: [],
    users: 1,
    display: "docked",
    displayOptions: {
      side: "left",
    },
  }

  userColor = randomColor()

  uniqueId = randomId()

  streamCount = 0

  messageStream = null

  commands = {}

  constructor(props) {
    super(props);

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

    this.chatArea = React.createRef();

    chatboxCommands(this);

    setTimeout(() => {
      // this.receiveRelayMessage(JSON.stringify({
      //   version: "2",
      //   type: "info-message",
      //   text: <div>Type <span className="command">\?</span> for a list of commands.</div>,
      // }));
      this.receiveRelayMessage(this.makeInfoMessage("type \\? for a list of commands"));
    }, 0);

    this.props.socket.on("server:message", (message) => {
      //this.receiveRelayMessage(this.makeInfoMessage("INFO"));
      console.log('MESSAGE FROM SERVER', message);
      this.receiveRelayMessage(message);
    });

    this.props.socket.on("server:lobby-connected-users", (users) => {
      const state = Object.assign({}, this.state);
      state.users = users;
      this.setState(state);
      this.receiveRelayMessage(this.makeInfoMessage(users + " total users are now connected."));
    });
  }

  openStream(kind, data={}) {
    let state = Object.assign({}, this.state);
    const key = this.streamCount;
    this.streamCount ++;
    console.log('CALL open');
    this.setState(prevState => {
      let state = Object.assign({}, prevState);
      state.streams.push({
        lines: [],
        key: key,
        open: true,
        data: data,
        kind: kind,
      });
      console.log('OPEN');
      return state;
    });
    return key;
  }

  closeStream(streamIndex) {
    if (this.state.streams[streamIndex]) {
      this.setState(prevState => {
        let state = Object.assign({}, prevState);
        state.streams[streamIndex].open = false;
        return state;
      });
    }
  }

  streamData(streamIndex, key=null, val=null) {
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

  print(streamIndex, line, time=10000) {
    // line = {kind: kind, content: content};
    line = Object.assign({kind: 'normal', classlist: []}, line);
    this.setState(prevState => {
      let state = Object.assign({}, prevState);
      if (state.streams[streamIndex] && state.streams[streamIndex].open) {
        let k = state.streams[streamIndex].lines.length;
        state.streams[streamIndex].lines.push(line);
        setTimeout(() => {
          this.setState(prevState2 => {
            let newstate = Object.assign({}, prevState2);
            if (newstate.streams[streamIndex]) {
              newstate.streams[streamIndex].lines[k].classlist.push('old');
            }
            return newstate;
          });
        }, time);
      } else {
        console.log('tried to print to closed stream.');
      }
      return state;
    }, () => {
      //console.log(this.chatArea.current);
      if (this.chatArea.current)
        this.chatArea.current.scrollTop = this.chatArea.current.scrollHeight + 1000;
    });
  }


  sendRelayMessage(relayMessage) {
    this.props.socket.emit("client:message", relayMessage);
    this.receiveRelayMessage(relayMessage, {mine: true});
  }

  receiveRelayMessage(relayMessage, options={mine: false}) {
    const message = JSON.parse(relayMessage);
    console.log('RECEIVING MESSAGE', message);
    if (!["1","2"].includes(message.version)) {
      console.log('wrong version');
      this.receiveRelayMessage(this.makeInfoMessage('Your version is out of date.'));
    }
    if (message.type == "user-message") {
      if ( this.messageStream === null
        || this.messageStream < this.streamCount-1
        || (this.stream(this.messageStream).kind != 'user-chunk')
        || (this.streamData(this.messageStream).sender != message.sender)
        || (this.streamData(this.messageStream).sender_id != message.sender_id)) {
        if (this.messageStream !== null) {
          this.closeStream(this.messageStream);
        }
        this.messageStream = this.openStream('user-chunk', {
          sender: message.sender,
          sender_id: message.sender_id,
        });
      }
      //console.log('STREAM!', this.state.streams[this.messageStream]);
      this.print(this.messageStream, {
        content:
          <span className={"user-message " +
                          (options.mine ? "my-message " : "")}>
            <span className="message-sender" style={{color: message.color}}>{message.sender}:</span>
            <span className="message-content">{message.text}</span>
          </span>,
        kind: 'user-message'
      });
    }
    if (message.type == "info-message") {
      console.log('MS',this.messageStream);
      if ( this.messageStream === null
        || this.messageStream < this.streamCount-1
        || (this.stream(this.messageStream).kind != 'info-chunk')) {
        if (this.messageStream !== null) {
          this.closeStream(this.messageStream);
        }
        this.messageStream = this.openStream('info-chunk');
      }
      //console.log('STREAM!', this.state.streams[this.messageStream]);
      this.print(this.messageStream, {
        content:
          <span className="info">
            <span className="message-content">{message.text}</span>
          </span>,
        kind: 'info-message'
      });
    }
    setTimeout(() => {
      console.log(this.messageStream, this.state);
    }, 100)
  }

  makeUserMessage (composition) {
    return JSON.stringify({
      version: "2",
      type: 'user-message',
      sender: model.state.user.username,
      sender_id: this.uniqueId,
      text: composition,
      color: this.userColor,
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
    this.print(streamIndex, {content: composition, kind: 'command-entered'});
    if (!this.commands[command]) {
      this.print(streamIndex, {
        content: <span>Unknown command <span className="command">\{command}</span>.</span>,
        kind: 'error'
      });
      this.closeStream(streamIndex);
    } else {
      this.commands[command].handler(argstr,streamIndex);
      if (! this.commands[command].opts.keepStreamOpen) {
        this.closeStream(streamIndex);
      }
    }
  }

  render() {
    console.log('RENDERING STATE',this.state);
    return (
      <div className={"chatbox"} display={this.state.display} display-side={this.state.displaySide}>
        <div className="chat-area" ref={this.chatArea}>
          {this.state.streams.map(stream =>
            <div className={"chat-stream " + (stream.lines.map(line => line.classlist.includes('old')).includes(false) ? '' : 'old')} open={stream.open ? true : false} kind={stream.kind} key={stream.key}>
              {stream.lines.map(line => <div className={"stream-line " + line.classlist.join(' ')} kind={line.kind} key={line.key}>{line.content}</div>)}
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
                    const message = this.makeUserMessage(composition);
                    this.sendRelayMessage(message);
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
