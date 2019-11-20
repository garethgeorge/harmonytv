import React from "react";
import model from "../../model";
import chatboxParsers from "./chatbox_parsers.jsx";
import chatboxValidaters from "./chatbox_validaters.jsx";
const debug = require("debug")("components:lobby:chatbox:commands");

export default (chatbox) => {
  const print = chatbox.commandPrint;
  const flush = chatbox.flushCommand;

  chatbox.registerCommand("?", (args) => {
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

    chatbox.print(
      <div>
        Commands:
        <ul className="command-list">
          {commands}
        </ul>
      </div>
      , { kind: "info" });
  }, {
    help: 'show command list'
  });

  // chatbox.registerCommand("test", (args) => {
  //   chatbox.print(`This is a test.`);
  //   chatbox.print(`This is a test.`);
  //   chatbox.print(`This is a test.`);
  //   chatbox.print(`This is a test.`);
  //   chatbox.print(`This is a test.`);
  // });

  chatbox.registerCommand("dock", (args) => {
    const side = args.side;
    const stateCpy = Object.assign({}, chatbox.state);
    stateCpy.docked = true;
    debug(args);
    if (side !== null) {
      stateCpy.side = side;
    }
    chatbox.setState(stateCpy, chatbox.savePreferences.bind(chatbox));
    chatbox.print(`Chatbox docking to ${stateCpy.side} side.`, { kind: "success" });
  }, {
    help: "docks the chat",
    args: [
      {
        name: "side",
        optional: true,
        validate: /^(left|right)$/,
      }
    ]
  });

  chatbox.registerCommand("float", (args) => {
    const side = args.side;
    const stateCpy = Object.assign({}, chatbox.state);
    stateCpy.docked = false;
    debug(args);
    if (side !== null) {
      stateCpy.side = side;
    }
    chatbox.setState(stateCpy, chatbox.savePreferences.bind(chatbox));
    chatbox.print(`Chatbox floating to ${stateCpy.side} side.`, { kind: "success" });
  }, {
    help: "docks the chat",
    args: [
      {
        name: "side",
        optional: true,
        validate: /^(left|right)$/,
      }
    ]
  });

  chatbox.registerCommand("clear", (args) => {
    const stateCpy = Object.assign({}, chatbox.state);
    stateCpy.messages = [];
    chatbox.setState(stateCpy);
    chatbox.print(`Clearing chat.`, { kind: "success" });
  }, {
    help: "clears chat messages",
  });

  chatbox.registerCommand("play", (args) => {
    document.getElementById('video').play(); // TODO: chatbox is a very bad way of doing chatbox by react conventions
    chatbox.print('Playing the video.', { kind: "success" });
  }, {
    help: "plays the video"
  });

  chatbox.registerCommand("pause", (args) => {
    document.getElementById('video').pause(); // TODO: chatbox is a very bad way of doing chatbox by react conventions
    chatbox.print('Pausing the video.', { kind: "success" });
  }, {
    help: "pauses the video"
  });

  chatbox.registerCommand("speed", (args) => {
    // To do. Needs backend support.
  }, {
    help: "change playback speed",
    secret: true,
  });

  chatbox.registerCommand("skip", (args) => {
    const skipby = args.dir * args.seconds;
    debug(skipby);
    document.getElementById('video').currentTime += skipby;
    if (skipby > 0) {
      chatbox.print('Skipping ahead ' + skipby + ' seconds.', { kind: "success" });
    } else {
      chatbox.print('Skipping back ' + (-skipby) + ' seconds.', { kind: "success" });
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

  chatbox.registerCommand("seek", (args) => {
    debug(args);
    document.getElementById('video').currentTime = args.time.seconds;
    chatbox.print('Seeking to ' + args.time.timestamp + '.', { kind: "success" });
  }, {
    help: "seek to a timestamp",
    args: [{
      name: "time",
      optional: false,
      validate: chatboxValidaters.timestamp,
      parse: chatboxParsers.timestamp
    }]
  });

  chatbox.registerCommand("volume", (args) => {
    const prev_volume = document.getElementById('video').volume;
    const arg = args.change;
    if (arg == "up") {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = Math.min(prev_volume + 0.2, 1);
      chatbox.print('Increasing volume.', { kind: "success" });
    }
    else if (arg == "down") {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = Math.max(prev_volume - 0.2, 0);
      chatbox.print('Decreasing volume.', { kind: "success" });
    }
    else if (arg == "mute") {
      document.getElementById('video').muted = true;
      chatbox.print('Muting volume.', { kind: "success" });
    }
    else if (arg == "unmute") {
      document.getElementById('video').muted = false;
      chatbox.print('Unmuting volume.', { kind: "success" });
    }
    else if (parseInt(arg) && 0 <= parseInt(arg) && parseInt(arg) <= 100) {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = parseInt(arg) / 100;
      chatbox.print('Setting volume to ' + arg + '.', { kind: "success" });
    }
  }, {
    help: "change volume (up, down, mute, unmute, 0-100)",
    args: [
      {
        name: "change",
        optional: false,
        validate: chatboxValidaters.choice(["up", "down", "mute", "unmute", chatboxValidaters.percent.source]),
      }
    ]
  });

  chatbox.registerCommand("mute", (args) => {
    document.getElementById('video').muted = true;
    chatbox.print('Muting video.', { kind: "success" });
  }, {
    secret: true,
    help: "mutes the video",
  });

  chatbox.registerCommand("unmute", (args) => {
    document.getElementById('video').muted = false;
    if (document.getElementById('video').volume < 0.2) {
      document.getElementById('video').volume = 0.2;
    }
    chatbox.print('Unmuting video.', { kind: "success" });
  }, {
    secret: true,
    help: "unmutes the video",
  });

  chatbox.registerCommand("fullscreen", (args) => {
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
    chatbox.print('Toggling fullscreen.', { kind: "success" });
  }, {
    help: "toggle fullscreen"
  });

  chatbox.registerCommand("usercolor", (args) => {
    let state = Object.assign({}, chatbox.state);
    const color = args.color;
    state.userColor = args.color;
    chatbox.setState(state, chatbox.savePreferences.bind(chatbox));
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

}
