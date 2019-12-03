import React from "react";
import model from "../../../model";
const debug = require("debug")("components:lobby:chatbox");

function reactifyMyMarkup(str, specs = []) {
  // console.log(str,specs)
  let markupOpen = /{{(\d+):(.*)$/g;
  let richContent = [];
  let remainder = str;
  while (remainder.length > 0) {
    let markOpen = markupOpen.exec(remainder);
    markupOpen.lastIndex = 0;
    if (markOpen == null) {
      richContent.push(remainder);
      remainder = "";
    } else if (markOpen.index == 0) {
      let number = markOpen[1];
      let internals = markOpen[2].split(":" + number + "}}")[0];
      remainder = markOpen[2].split(":" + number + "}}")[1];
      let spec = specs[parseInt(number)];
      richContent.push(
        React.createElement(
          spec.tag,
          { key: number, ...spec.props },
          reactifyMyMarkup(internals, specs)
        )
      );
    } else {
      richContent.push(remainder.substring(0, markOpen.index));
      remainder = remainder.substring(markOpen.index);
    }
  }
  // console.log(richContent);
  return <>{richContent}</>;
}

function messageHandler(chatbox) {
  // Template Message:
  // message = {
  //   metaData: {
  //     protocolVersion: 3,
  //     senderName: sender,
  //     senderDeviceId: senderId,
  //     timeSent: timestamp,
  //     videoTime: timestamp,
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
    let newMessage = { ...message };
    if (!message.hasOwnProperty("content")) {
      newMessage = { content: message };
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
    if (!newMessage.metaData.videoTime) {
      newMessage.metaData.videoTime = document.getElementById(
        "video"
      ).currentTime;
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
  };

  chatbox.protocolVersion = 3;
  chatbox.messageTypes = {};
  chatbox.messageStream = null;

  chatbox.registerMessageType = (name, handler) => {
    chatbox.messageTypes[name] = handler;
  };

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
      chatbox.messageStream = chatbox.openStream(message.metaData.streamKind, {
        group: JSON.stringify(message.metaData.group),
      });
      ms = chatbox.messageStream;
    }
    if (chatbox.messageTypes.hasOwnProperty(message.metaData.messageType)) {
      let line = chatbox.messageTypes[message.metaData.messageType](message);
      chatbox.print(ms, {
        content: line,
        kind: message.metaData.messageKind
          ? message.metaData.messageKind
          : message.metaData.messageType,
      });
    } else {
      console.log(
        "Could not add message. No handler for " + message.metaData.messageType
      );
      console.log("Message:", message);
      chatbox.print(ms, {
        content: <div>had trouble adding message. No handler.</div>,
        kind: "none",
      });
    }
  };

  chatbox.sendMessage = (message, metoo = true) => {
    message = fillMessageData(message);
    chatbox.props.socket.emit("client:message", JSON.stringify(message));
    if (metoo) {
      chatbox.addMessage(message);
    }
  };

  chatbox.receiveMessage = (message) => {
    chatbox.addMessage(JSON.parse(message));
  };

  function enrich(intext, specN = -1) {
    let text = intext;
    if (specN == -1) {
      text = text.replace(/[\\{}]/g, "\\$&");
    }

    let matches = {};
    let firstmatch = null;
    let firstmatchI = null;
    for (let formatterI in registeredFormatters) {
      let formatter = registeredFormatters[formatterI];
      let match = formatter.regex.exec(text);
      formatter.regex.lastIndex = 0;
      matches[formatter.name] = match;
      if (
        match != null &&
        (firstmatch == null || match.index < matches[firstmatch].index)
      ) {
        firstmatch = formatter.name;
        firstmatchI = formatterI;
      }
    }
    if (firstmatch == null) {
      return {
        text: text.replace(/\\([\\{}])/g, "$1"),
        specs: [],
        specN: specN,
        extras: [],
      };
    }
    let match = matches[firstmatch];
    let mark = registeredFormatters[firstmatchI].handler(match);
    specN = specN + 1;
    let n = specN;
    let inner;
    if (!mark.halt) {
      inner = enrich(mark.text, specN);
      specN = inner.specN;
    } else {
      inner = { text: mark.text, specs: [], specN: specN, extras: [] };
    }
    let rest = enrich(text.substring(match.index + match[0].length), specN);
    specN = rest.specN;
    let specs = [mark.spec].concat(inner.specs, rest.specs);
    let extras = (mark.extra ? [mark.extra] : []).concat(
      inner.extras,
      rest.extras
    );
    let newtext =
      text.substring(text, match.index) +
      (mark.before ? mark.before : "") +
      "{{" +
      n +
      ":" +
      inner.text +
      ":" +
      n +
      "}}" +
      (mark.after ? mark.after : "") +
      rest.text;

    return { text: newtext, specs: specs, specN: specN, extras: extras };
  }

  let registeredFormatters = [
    {
      name: "urllink",
      regex: /(https?:\/\/)?(([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}(\:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?/gi,
      //regex: /(^|\s)((https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(\#[-a-z\d_]*)?)($|\s)/gi,
      // regex: new RegExp('(^|\\s)((https?:\\/\\/)?'+ // protocol
      //   '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
      //   '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      //   '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      //   '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      //   '(\\#[-a-z\\d_]*)?)($|\\s)','gi'), // fragment locator
      handler: (match) => {
        const url = match[0];
        const linkto = url.split("://").length > 1 ? url : "https://" + url;
        const domain = linkto.match(
          /(https?:\/\/)(([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}/gi
        );
        // ideally fetch the webpage head to get title and description
        // CORS was making that difficult though.
        const title = /(https?:\/\/)?([a-z\d]([a-z\d-]*[a-z\d])*)+/gi.exec(
          linkto
        )[2];
        const description = linkto;
        return {
          text: url,
          spec: {
            tag: "a",
            props: {
              target: "_",
              href: linkto,
            },
          },
          halt: true,
          extra: (
            <>
              <a className="message-extra-urllink" href={linkto} target="_">
                <object
                  data={domain + "/favicon.ico"}
                  type="image/x-icon"
                  className="extra-urllink-icon"
                ></object>
                <div className="extra-urllink-info">
                  <h6 className="extra-urllink-title">
                    {title.replace(/^./, title[0].toUpperCase())}
                  </h6>
                  <p className="extra-urllink-description">{linkto}</p>
                </div>
              </a>
            </>
          ),
        };
      },
    },
    {
      name: "bold",
      regex: /\*([^\s].*?[^\s]|[^\s])\*/g,
      handler: (match) => {
        return {
          text: match[1],
          spec: { tag: "span", props: { className: "markup-bold" } },
        };
      },
    },
    {
      name: "italic",
      regex: /_([^\s].*?[^\s]|[^\s])_/g,
      handler: (match) => {
        return {
          text: match[1],
          spec: { tag: "span", props: { className: "markup-italic" } },
        };
      },
    },
  ];

  function enrichContent(content) {
    if (content.raw) {
      // for raw content
      return { content: content.text, extras: [] };
    } else if (!content.rich) {
      // for normally enriched content
      let enriched = enrich(content.text);
      return {
        content: reactifyMyMarkup(enriched.text, enriched.specs),
        extras: enriched.extras,
      };
    } else {
      // for content specifically intended to be rich.
      // fill this in.
      return { content: content.text, extras: [] };
    }
  }

  // Registering Handlers:
  chatbox.registerMessageType("info", (message) => {
    return (
      <span className="info">
        <span className="message-content">{message.content.text}</span>
      </span>
    );
  });
  chatbox.registerMessageType("conn-user-joined", (message) => {
    return (
      <span className="info">
        <span className="message-content">
          {message.content.users} users are in the lobby.
        </span>
      </span>
    );
  });
  chatbox.registerMessageType("user-message", (message) => {
    const enriched = enrichContent(message.content);
    const messageContent = enriched.content;
    const messageExtras = enriched.extras;
    console.log("EXTRAS:", messageExtras);
    let date = new Date(message.metaData.timeSent);
    const timestamp = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <span
        className={
          "user-message " +
          (chatbox.uniqueId == message.metaData.senderDeviceId
            ? "my-message "
            : "")
        }
      >
        <span
          className="message-sender"
          style={{ color: message.content.userColor }}
        >
          <span className="sender-tab">{message.metaData.senderName}</span>
        </span>
        <span className="message-content">
          {message.content.replyTo ? (
            <div className="message-replyto">
              <blockquote>
                {enrichContent(message.content.replyTo.content).content}
              </blockquote>
              <div class="message-replyuser">
                {message.content.replyTo.metaData.senderName}
              </div>
            </div>
          ) : null}
          {messageContent}
          <div className="message-time">
            <span>{timestamp}</span>
          </div>
          <span className="message-more">
            <i className="material-icons md-light" style={{ fontSize: "16px" }}>
              more_vert
            </i>
            <div className="message-menu">
              <div
                className="message-menu-item"
                onClick={() => {
                  console.log(message);
                  chatbox.setState((prevState) => {
                    let state = { ...prevState };
                    state.modifiers.replyTo = message;
                    return state;
                  });
                }}
              >
                <i
                  className="material-icons md-light"
                  style={{ fontSize: "16px" }}
                >
                  reply
                </i>
                Reply
              </div>
            </div>
          </span>
        </span>
        {messageExtras.map((extra, i) => {
          return (
            <div className="message-extra" key={i}>
              {extra}
            </div>
          );
        })}
      </span>
    );
  });
  chatbox.registerMessageType("whisper-message", (message) => {
    const enriched = enrichContent(message.content);
    const messageContent = enriched.content;
    const messageExtras = enriched.extras;
    console.log("EXTRAS:", messageExtras);
    let date = new Date(message.metaData.timeSent);
    const timestamp = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    // IDEALLY, THIS LOGIC SHOULD BE SERVERSIDE.
    if (
      model.state.user.username != message.content.recipient &&
      model.state.user.username != message.metaData.senderName
    ) {
      return null;
    }
    return (
      <span
        className={
          "whisper-message " +
          (chatbox.uniqueId == message.metaData.senderDeviceId
            ? "my-message "
            : "")
        }
      >
        <span
          className="message-sender"
          style={{ color: message.content.userColor }}
        >
          <span className="sender-tab">
            {message.metaData.senderName}
            <span className="whisper-indicator">
              {" "}
              (whisper
              {message.metaData.senderName == model.state.user.username
                ? " to " + message.content.recipient
                : ""}
              )
            </span>
          </span>
        </span>
        <span className="message-content">
          {messageContent}
          <div className="message-time">
            <span>{timestamp}</span>
          </div>
        </span>
        {messageExtras.map((extra, i) => {
          return (
            <div className="message-extra" key={i}>
              {extra}
            </div>
          );
        })}
      </span>
    );
  });
}

export default messageHandler;
