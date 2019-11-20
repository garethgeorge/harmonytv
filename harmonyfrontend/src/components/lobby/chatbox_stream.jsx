import React from "react";
import { observer } from "mobx-react";

export default observer(class ChatStream extends React.Component {
  state = {
    lines: [],
    open: true,
  }

  constructor(props) {
    super(props);
    this.lines = React.createRef();
  }

  print(content, kind='') {
    let state = Object.assign({}, this.state);
    console.log(this);
    var line = {
      key: this.state.lines.length,
      content: content,
      kind: kind,
    };
    state.lines.push(line);
    this.setState(state);
  }

  open() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  render() {
    return (
      <div className="chat-stream" kind={this.props.kind}>
        {this.state.lines}
      </div>
    )
    // const lines = [];
    // for (const line of this.state.lines) {
    //   lines.push(
    //     <span
    //       className={"chat-text " + message.kind + " " + message.data.classlist.join(" ")}
    //       key={message.key}
    //       {...message.data.attributes}
    //     >
    //       {message.text}
    //     </span>
    //   );
    // }
    //
    // return (
    //   <div className={"chatbox " + (this.state.docked ? "docked " : "") + this.state.side}>
    //     <div className="messages" ref={this.messages}>{messages}</div>
    //     {/* functionally this is padding */}
    //     <div style={{ height: "30px", color: "red" }}></div>
    //     {/* this is the actual text input */}
    //     <input ref={this.textEntry} className={"chatboxTextEntry " + (this.state.composition[0] == "\\" ? "command" : "")} type="text"
    //       value={this.state.composition}
    //       onChange={(e) => {
    //         const state = Object.assign({}, this.state);
    //         state.composition = e.target.value;
    //         this.setState(state);
    //       }}
    //       onKeyDown={(e) => {
    //         if (e.key === "Enter") {
    //           if (this.state.composition.length > 0) {
    //             const state = Object.assign({}, this.state)
    //             const composition = this.state.composition;
    //             state.composition = "";
    //             this.setState(state, () => {
    //               // send the message if it is not a special command
    //               if (composition[0] != "\\") {
    //                 const message = this.makeMessage(composition);
    //                 this.sendRelayMessage(message);
    //               } else { // do the command if it is known
    //                 this.execCommand(composition);
    //               }
    //             });
    //           } else {
    //             if (!this.state.docked) {
    //               this.textEntry.current.blur();
    //             }
    //           }
    //         }
    //       }} />
    //   </div>
    // )
  }
});
