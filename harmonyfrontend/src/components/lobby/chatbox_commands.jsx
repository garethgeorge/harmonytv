import React from "react";
import model from "../../model";
import chatboxCommandRegister from "./chatbox_command_registration.jsx";
import chatboxParsers from "./chatbox_parsers.jsx";
import chatboxValidaters from "./chatbox_validaters.jsx";
const debug = require("debug")("components:lobby:chatbox:commands");

export default (chatbox) => {
  chatboxCommandRegister(chatbox);

  const print = chatbox.commandPrint;
  const flush = chatbox.flushCommand;

  chatbox.registerCommand("?", (args,stream) => {
    const commands = Object.values(chatbox.commands).map(command => {
      if (command.opts.secret) {
        return;
      }
      let text = null;
      if (!text && command.opts.help)
        text = command.opts.help

      return (
        <li>{command.usage} {text}</li>
      )
    });
    debug(commands);

    chatbox.print(stream, {content:
      <div>
        Commands:
        <ul className="command-list">
          {commands}
        </ul>
      </div>,
      kind: "info" });
  }, {
    help: 'show command list'
  });

  chatbox.registerCommand("test", (args,stream) => {
    // chatbox.sendRelayMessage({version: "1", type: "user-joined", sender: model.state.user.username, color: chatbox.userColor});
    console.log('MODEL:',model);
    let count = 5;
    let interval = setInterval( () => {
      console.log('TEST');
      chatbox.print(stream, {content: `did test.`, kind: "info" });
      count --;
      if (count <= 0) {
        clearInterval(interval);
        chatbox.closeStream(stream);
      }
    }, 2000)
  }, {
    secret: true,
    keepStreamOpen: true,
  });

  chatbox.registerCommand("dock", (args,stream) => {
    const side = args.side;
    const stateCpy = Object.assign({}, chatbox.state);
    stateCpy.display = "docked";
    console.log(args);
    if (side !== null) {
      stateCpy.displayOptions.side = side;
    }
    chatbox.setState(stateCpy);
    chatbox.print(stream, {content: `Chatbox docking to ${stateCpy.displayOptions.side} side.`, kind: "success" });
  }, {
    help: "docks the chat",
    args: [
      {
        name: "side",
        optional: true,
        validate: chatboxValidaters.choice(["left","right"]),
      }
    ]
  });

  chatbox.registerCommand("float", (args,stream) => {
    const side = args.side;
    const visibility = args.visibility;
    const stateCpy = Object.assign({}, chatbox.state);
    stateCpy.display = "float";
    console.log(args);
    if (side !== null) {
      stateCpy.displayOptions.side = side;
    }
    if (visibility !== null) {
      stateCpy.displayOptions.visibility = visibility;
    }
    chatbox.setState(stateCpy, chatbox.savePreferences.bind(chatbox));
    chatbox.print(stream, {content: `Chatbox floating to ${stateCpy.displayOptions.side} side.`, kind: "success" });
  }, {
    help: "docks the chat",
    args: [
      {
        name: "side",
        optional: true,
        validate: chatboxValidaters.choice(["left","right"]),
      },
      {
        name: "visibility",
        optional: true,
        validate: chatboxValidaters.choice(["invisible","visible"]),
      }
    ]
  });

  chatbox.registerCommand("clear", (args,stream) => {
    const stateCpy = Object.assign({}, chatbox.state);
    stateCpy.streams = [];
    chatbox.messageStream = null;
    chatbox.streamCount = 0;
    chatbox.setState(stateCpy);
    //chatbox.print(stream, {content: `Clearing chat.`, kind: "success" });
  }, {
    help: "clears chat messages",
  });

  chatbox.registerCommand("play", (args,stream) => {
    document.getElementById('video').play(); // TODO: chatbox is a very bad way of doing chatbox by react conventions
    chatbox.print(stream, {content: 'Playing the video.', kind: "success" });
  }, {
    help: "plays the video"
  });

  chatbox.registerCommand("pause", (args,stream) => {
    document.getElementById('video').pause(); // TODO: chatbox is a very bad way of doing chatbox by react conventions
    chatbox.print(stream, {content: 'Pausing the video.', kind: "success" });
  }, {
    help: "pauses the video"
  });

  chatbox.registerCommand("speed", (args,stream) => {
    // To do. Needs backend support.
  }, {
    help: "change playback speed",
    secret: true,
  });

  chatbox.registerCommand("skip", (args,stream) => {
    const skipby = args.dir * args.seconds;
    debug(skipby);
    document.getElementById('video').currentTime += skipby;
    if (skipby > 0) {
      chatbox.print(stream, {content: 'Skipping ahead '+skipby+' seconds.', kind: "success"});
    } else {
      chatbox.print(stream, {content: 'Skipping back '+(-skipby)+' seconds.', kind: "success"});
    }
  }, {
    help: "skip forward by seconds",
    args: [
      {
        name: 'dir',
        optional: true,
        validate: chatboxValidaters.choice(['forward', 'ahead', 'back', 'backward']),
        parse: chatboxParsers.choice({ forward: 1, ahead: 1, back: -1, backward: -1 }),
        fallback: 1,
      },
      {
        name: "seconds",
        optional: false,
        validate: chatboxValidaters.number,
        parse: parseInt,
      }
    ]
  });

  chatbox.registerCommand("seek", (args,stream) => {
    console.log(args);
    document.getElementById('video').currentTime = args.time.seconds;
    chatbox.print(stream, {content: 'Seeking to '+args.time.timestamp+'.', kind: "success"});
  }, {
    help: "seek to a timestamp",
    args: [{
      name: "time",
      optional: false,
      validate: chatboxValidaters.timestamp,
      parse: chatboxParsers.timestamp
    }]
  });

  chatbox.registerCommand("volume", (args,stream) => {
    const prev_volume = document.getElementById('video').volume;
    const arg = args.change;
    if (arg == "up") {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = Math.min(prev_volume+0.2,1);
      chatbox.print(stream, {content: 'Increasing volume.', kind: "success"});
    }
    else if (arg == "down") {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = Math.max(prev_volume-0.2,0);
      chatbox.print(stream, {content: 'Decreasing volume.', kind: "success"});
    }
    else if (arg == "mute") {
      document.getElementById('video').muted = true;
      chatbox.print(stream, {content: 'Muting volume.', kind: "success"});
    }
    else if (arg == "unmute") {
      document.getElementById('video').muted = false;
      chatbox.print(stream, {content: 'Unmuting volume.', kind: "success"});
    }
    else if (parseInt(arg) && 0 <= parseInt(arg) && parseInt(arg) <= 100) {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = parseInt(arg)/100;
      chatbox.print(stream, {content: 'Setting volume to '+arg+'.', kind: "success"});
    }
  }, {
    help: "change volume (up, down, mute, unmute, 0-100%)",
    args: [
      {
        name: "change",
        optional: false,
        validate: chatboxValidaters.choice(["up", "down", "mute", "unmute", chatboxValidaters.percent.source]),
      }
    ]
  });

  chatbox.registerCommand("mute", (args,stream) => {
    document.getElementById('video').muted = true;
    chatbox.print(stream, {content: 'Muting video.', kind: "success" });
  }, {
    secret: true,
    help: "mutes the video",
  });

  chatbox.registerCommand("unmute", (args,stream) => {
    document.getElementById('video').muted = false;
    if (document.getElementById('video').volume < 0.2) {
      document.getElementById('video').volume = 0.2;
    }
    chatbox.print(stream, {content: 'Unmuting video.', kind: "success" });
  }, {
    secret: true,
    help: "unmutes the video",
  });

  chatbox.registerCommand("fullscreen", (args,stream) => {
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
    chatbox.print(stream, {content: 'Toggling fullscreen.', kind: "success" });
  }, {
    help: "toggle fullscreen"
  });

  chatbox.registerCommand("usercolor", (args,stream) => {
    const color = args.color;
    chatbox.userColor = args.color;
    // in future change colors for other ppl too.
  }, {
    help: "change your name's color",
    args: [
      {
        name: 'color',
        optional: false,
        validate: chatboxValidaters.color,
        parse: chatboxParsers.color,
      }
    ]
  });

  chatbox.registerCommand("whisper", (args,stream) => {
    chatbox.sendRelayMessage(chatbox.makeWhisperMessage(args.message,args.user));
    // ideally deal with this serverside
  }, {
    help: "send a message to a specific user",
    args: [
      {
        name: 'user',
        optional: false,
      },
      {
        name: 'message',
        optional: false,
      }
    ]
  });

  chatbox.registerCommand("writenote", (args,stream) => {
    chatbox.notes.push(args.text);
  }, {
    help: "write a note",
    args: [
      {
        name: 'text',
        optional: false,
      },
    ]
  });

  chatbox.registerCommand("readnotes", (args,stream) => {
    console.log(chatbox.notes);
    var k = 1;
    for (const note of chatbox.notes) {
      chatbox.print(stream, {content: k+'. '+note});
      k++;
    }
  }, {
    help: "read your notes",
  });

  chatbox.registerCommand("clearnotes", (args,stream) => {
    chatbox.notes = [];
    chatbox.print(stream, {content: 'all notes deleted'});
  }, {
    help: "deleta all your notes",
  });

  chatbox.registerCommand("deletenote", (args,stream) => {
    chatbox.print(stream, {content: 'deleted note '+args.index});
    chatbox.print(stream, {content: chatbox.notes.splice(args.index-1,1)});
  }, {
    help: "delete a note",
    args: [
      {
        name: 'index',
        optional: false,
        validate: chatboxValidaters.integer,
        parse: parseInt,
      },
    ]
  });

}
