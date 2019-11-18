import React from "react";

export default (chatbox) => {
  chatbox.registerCommand("?", (args) => {
    console.log('hi');
    const commands = Object.values(chatbox.commands).map(command => {
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
    console.log(commands);

    chatbox.addMessage(
      <div>
        Commands:
        <ul className="command-list">
          {commands}
        </ul>
      </div>
      , { kind: "info" });
  }, {
    help: 'show chatbox list'
  });

  chatbox.registerCommand("dock", (args) => {
    const side = args.side;
    const stateCpy = Object.assign({}, chatbox.state);
    stateCpy.docked = true;
    console.log(args);
    if (side !== null) {
      stateCpy.side = side;
    }
    chatbox.setState(stateCpy, () => {
      chatbox.addMessage(`Chatbox docked to ${stateCpy.side} side.`, { kind: "success" });
    });
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
    console.log(args);
    if (side !== null) {
      stateCpy.side = side;
    }
    chatbox.setState(stateCpy, () => {
      chatbox.addMessage(`Chatbox floated to ${stateCpy.side} side.`, { kind: "success" });
    });
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
  }, {
    help: "clears chat messages",
  });

  chatbox.registerCommand("play", (args) => {
    document.getElementById('video').play(); // TODO: chatbox is a very bad way of doing chatbox by react conventions
    chatbox.addMessage('Playing the video.', { kind: "success" });
  }, {
    help: "plays the video"
  });

  chatbox.registerCommand("pause", (args) => {
    document.getElementById('video').pause(); // TODO: chatbox is a very bad way of doing chatbox by react conventions
    chatbox.addMessage('Paused the video.', { kind: "success" });
  }, {
    help: "pauses the video"
  });

  chatbox.registerCommand("skip", (args) => {
    const skipby = args.dir * args.seconds;
    console.log(skipby);
    document.getElementById('video').currentTime += skipby;
    if (skipby > 0) {
      chatbox.addMessage('Skipped ahead '+skipby+' seconds.', {kind: "success"});
    } else {
      chatbox.addMessage('Skipped back '+(-skipby)+' seconds.', {kind: "success"});
    }
  }, {
    help: "skip forward by seconds",
    args: [
      {
        name: 'dir',
        optional: true,
        validate: /^(forward|ahead|back)$/,
        parse: (str) => {if (str == 'ahead' || str == 'forward') {return 1;}; if (str == 'back') {return -1;};},
        fallback: 1,
      },
      {
        name: "seconds",
        optional: false,
        validate: /^-?[123456789][0-9]*\.?[0-9]*$/,
        parse: parseInt,
      }
    ]
  });

  chatbox.registerCommand("seek", (args) => {
    console.log(args);
    document.getElementById('video').currentTime = args.time.seconds;
    chatbox.addMessage('Seeked to '+args.time.timestamp+'.', {kind: "success"});
  }, {
    help: "seek to a timestamp",
    args: [{
      name: "time",
      optional: false,
      validate: /^\d+:[0-5]\d(:[0-5]\d)?(.\d+)?$/,
      parse: (timestamp) => {
        const parts = timestamp.split(':');
        return {
          seconds: (parts.length == 2 ?
            60*parseInt(parts[0]) + parseInt(parts[1]) :
            60*60*parseInt(parts[0]) + 60*parseInt(parts[1]) + parseInt(parts[0])),
          timestamp: timestamp};
        }
    }]
  });

  chatbox.registerCommand("volume", (args) => {
    const prev_volume = document.getElementById('video').volume;
    const arg = args.change;
    if (arg == "up") {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = Math.min(prev_volume+0.2,1);
      chatbox.addMessage('Volume increased.', {kind: "success"});
    }
    else if (arg == "down") {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = Math.max(prev_volume-0.2,0);
      chatbox.addMessage('Volume decreased.', {kind: "success"});
    }
    else if (arg == "mute") {
      document.getElementById('video').muted = true;
      chatbox.addMessage('Volume muted.', {kind: "success"});
    }
    else if (arg == "unmute") {
      document.getElementById('video').muted = false;
      chatbox.addMessage('Volume unmuted.', {kind: "success"});
    }
    else if (parseInt(arg) && 0<=parseInt(arg) && parseInt(arg)<=100) {
      document.getElementById('video').muted = false;
      document.getElementById('video').volume = parseInt(arg)/100;
      chatbox.addMessage('Volume set to '+parseInt(arg)+'.', {kind: "success"});
    }
    else {
      chatbox.addMessage('change must be one of \'up\', \'down\', \'mute\', \'unmute\' or a parseInt 0-100.', {kind: "warning"});
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

  chatbox.registerCommand("mute", (args) => {
    document.getElementById('video').muted = true;
    chatbox.addMessage('Video muted.', { kind: "success" });
  }, {
    secret: true,
    help: "mutes the video",
  });

  chatbox.registerCommand("unmute", (args) => {
    document.getElementById('video').muted = false;
    if (document.getElementById('video').volume < 0.2) {
      document.getElementById('video').volume = 0.2;
    }
    chatbox.addMessage('Video unmuted.', { kind: "success" });
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
    chatbox.addMessage('Toggling fullscreen.', { kind: "success" });
  }, {
    help: "toggle fullscreen"
  });
}
