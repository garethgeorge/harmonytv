import React from "react";
import model from "../../../model";
const debug = require("debug")("components:lobby:chatbox");

function messageHandler(chatbox) {

  // Template Message:
  // message = {
  //   metaData: {
  //     protocolVersion: 3,
  //     senderName: sender,
  //     senderDeviceId: senderId,
  //     timeSent: timestamp,
  //     group: group,
  //     streamKind: kind,
  //     messageType: type,
  //     messageKind: kind,
  //   },
  //   content: {
  //     text: "",
  //   }
  // }

  const fillMessageData = (message) => {
    let newMessage = {...message};
    if (!message.hasOwnProperty('content')) {
      newMessage = {content: message};
    }
    if (!newMessage.metaData) {
      newMessage.metaData = {};
    }
    if (!newMessage.metaData.protocolVersion) {
      newMessage.metaData.protocolVersion = chatbox.protocolVersion;
    }
    if (!newMessage.metaData.senderName) {
      newMessage.metaData.senderName = model.state.user.username;
    }
    if (!newMessage.metaData.senderDeviceId) {
      newMessage.metaData.senderDeviceId = chatbox.uniqueId;
    }
    if (!newMessage.metaData.timeSent) {
      newMessage.metaData.timeSent = Date.now();
    }
    if (!newMessage.metaData.streamKind) {
      newMessage.metaData.streamKind = "normal";
    }
    // if (!newMessage.metaData.messageKind) {
    //   newMessage.metaData.messageKind = "normal";
    // }
    if (!newMessage.metaData.messageType) {
      newMessage.metaData.messageType = "none";
    }
    if (!newMessage.metaData.group) {
      newMessage.metaData.group = {
        streamKind: newMessage.metaData.streamKind,
        messageType: newMessage.metaData.messageType,
        senderDeviceId: newMessage.metaData.senderDeviceId,
      };
    }
    return newMessage;
  }

  chatbox.protocolVersion = 3;
  chatbox.messageTypes = {};
  chatbox.messageStream = null;

  chatbox.registerMessageType = (name,handler) => {
    chatbox.messageTypes[name] = handler;
  }

  chatbox.addMessage = (message) => {
    message = fillMessageData(message);
    let ms = chatbox.messageStream;
    if (
      ms === null ||
      ms < chatbox.streamCount - 1 ||
      chatbox.stream(ms).kind != message.metaData.streamKind ||
      chatbox.stream(ms).data.group != JSON.stringify(message.metaData.group)
    ) {
      if (ms !== null) {
        chatbox.closeStream(ms);
      }
      chatbox.messageStream = chatbox.openStream(message.metaData.streamKind, {group: JSON.stringify(message.metaData.group)});
      ms = chatbox.messageStream;
    }
    if (chatbox.messageTypes.hasOwnProperty(message.metaData.messageType)) {
      let line = chatbox.messageTypes[message.metaData.messageType](message);
      chatbox.print(ms, {
        content: line,
        kind: message.metaData.messageKind ? message.metaData.messageKind : message.metaData.messageType,
      });
    } else {
      console.log('Could not add message. No handler for '+message.metaData.messageType);
      console.log('Message:', message);
      chatbox.print(ms, {
        content: <div>had trouble adding message. No handler.</div>,
        kind: "none",
      });
    }
  }

  chatbox.sendMessage = (message, metoo=true) => {
    message = fillMessageData(message);
    chatbox.props.socket.emit("client:message", JSON.stringify(message));
    if (metoo) {
      chatbox.addMessage(message);
    }
  }

  chatbox.receiveMessage = (message) => {
    chatbox.addMessage(JSON.parse(message));
  }

  function enrichContent(content) {
    if (content.raw) {
      return content.text;
    } else if (!content.rich) {
      let contentParts = [];
      var urlfinder = new RegExp('(^|\\s)(https?:\\/\\/)?'+ // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
        '(\\#[-a-z\\d_]*)?(\\s|$)','gi'); // fragment locator
      var textIndex = 0;
      var urlmatch = urlfinder.exec(content.text);
      while (urlmatch) {
        console.log(urlmatch);
        contentParts.push(<span> {content.text.substring(textIndex,urlmatch.index)} </span>);
        const url = urlmatch[0].trim();
        contentParts.push(<a target="_" href={url.split('://').length > 1 ? url : 'https://'+url}>{url}</a>);
        textIndex += urlmatch.index + urlmatch[0].length;
        urlmatch = urlfinder.exec(content.text);
      }
      contentParts.push(<span> {content.text.substring(textIndex)}</span>);
      return <>{contentParts}</>;
    } else {
      // fill this in.
      return content.text;
    }
  }

  // Registering Handlers:
  chatbox.registerMessageType("info", (message) => {
    return (
      <span
        className="info"
      >
        <span className="message-content">{message.content.text}</span>
      </span>
    )
  });
  chatbox.registerMessageType("conn-user-joined", (message) => {
    return (
      <span
        className="info"
      >
        <span className="message-content">{message.content.users} users are in the lobby.</span>
      </span>
    )
  });
  chatbox.registerMessageType("user-message", (message) => {
    const messageContent = enrichContent(message.content);
    let date = new Date(message.metaData.timeSent);
    const timestamp = date.toLocaleTimeString([],{hour: "numeric", minute: "2-digit"});
    return (
      <span
        className={"user-message " + (chatbox.uniqueId == message.metaData.senderDeviceId ? "my-message " : "")}
      >
        <span className="message-sender" style={{ color: message.content.userColor }}>
          <span className="sender-tab">{message.metaData.senderName}</span>
        </span>
        <span className="message-content">{messageContent}
          <div className="message-time"><span>{timestamp}</span></div>
        </span>
      </span>
    )
  });
  chatbox.registerMessageType("whisper-message", (message) => {
    const messageContent = enrichContent(message.content);
    let date = new Date(message.metaData.timeSent);
    const timestamp = date.toLocaleTimeString([],{hour: "numeric", minute: "2-digit"});
    return (
      <span
        className={"whisper-message " + (chatbox.uniqueId == message.metaData.senderDeviceId ? "my-message " : "")}
      >
        <span className="message-sender" style={{ color: message.content.userColor }}>
          <span className="sender-tab">{message.metaData.senderName}<span class="whisper-indicator"> (whisper{
            message.metaData.senderName == model.state.user.username
            ? " to "+message.content.recipient
            : ""})</span></span>
        </span>
        <span className="message-content">{messageContent}
          <div className="message-time"><span>{timestamp}</span></div>
        </span>
      </span>
    )
  });
}

export default messageHandler
