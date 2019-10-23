import React from "react";
import config from "../config";
import model from "../model";
import "./player.css";

// load shaka, example from: https://github.com/amit08255/shaka-player-react-with-ui-config/blob/master/with-default-ui/src/components/VideoPlayer.js
import 'shaka-player/dist/controls.css';
const shaka = require('shaka-player/dist/shaka-player.ui.js');


class Player extends React.Component {
  state = {}

  constructor(props) {
    super(props);

    this.videoComponent = React.createRef();
    this.videoContainer = React.createRef();

    this.onErrorEvent = this.onErrorEvent.bind(this);
    this.onError = this.onError.bind(this);
  }

  // handling errors from shaka
  onErrorEvent(event) {
    this.onError(event.detail);
  }

  onError(error) {
    console.error('Error code', error.code, 'object', error);
  }

  isDashSupported() {
    return window.MediaSource && shaka.Player.isBrowserSupported();
  }

  componentDidMount() {
    //Getting reference to video and video container on DOM
    const video = this.videoComponent.current;
    const videoContainer = this.videoContainer.current;

    const player = new shaka.Player(video);

    // https://github.com/google/shaka-player/blob/d98543165cff6dc545eeaefcd660818d971cca33/demo/main.js#L91
    const castProxy = new shaka.cast.CastProxy(video, player, "00A3C5E8");
      
    const ui = new shaka.ui.Overlay(player, videoContainer, video);
    ui.configure({
      "controlPanelElements": ["play_pause", "time_and_duration", "spacer", "mute", "volume", "fullscreen", "overflow_menu"],
      "overflowMenuButtons": ["captions", "cast", "quality", "language", "picture_in_picture"],
      "addBigPlayButton": false,
    })
    const controls = ui.getControls();

    // setTimeout(() => {
    //   if (!castProxy.canCast()) {
    //     if (!castProxy._sender)
    //       alert("no sender");
    //     else 
    //       alert("cast api ready? " + castProxy._sender.apiReady() + " hasReceivers? " + castProxy._sender.hasReceivers());
    //   } else 
    //     alert("can cast!");
    // }, 10000);

    player.addEventListener('error', this.onErrorEvent);

    this.videoElem = video;
    this.shakaUi = ui;
    this.shakaPlayer = player;
  }

  playVideo(mediaid, callback=null) {
    console.log("Player::playVideo(" + mediaid + ")");

    if (!this.shakaPlayer) {
      return alert("attempted to playVideo(" + mediaid + ") before shakaPlayer was initialized (please wait for componentDidMount)");
    }

    model.media.getInfo(mediaid).then(media => {
      console.log("MEDIA INFO: " + JSON.stringify(media));
      
      const manifestUrl = config.apiHost + "/media/" + mediaid + "/files/stream.mpd";

      const player = this.shakaPlayer;

      player.load(manifestUrl).then(() => {
        console.log('The video has now been loaded!');
        
        const metadata = media.metadata;
        console.log("VIDEO METADATA: " + JSON.stringify(metadata));

        console.log("loading subtitles");
        for (const language of Object.keys(metadata.subtitles)) {
          const subtitle = metadata.subtitles[language];
          console.log("\tadding subtitle language: " + language + " - file url: " + (config.apiHost + "/media/" + mediaid + "/files/" + subtitle.file));

          player.addTextTrack(
            config.apiHost + "/media/" + mediaid + "/files/" + subtitle.file, 
            language, "captions", "text/vtt"
          );
        }

        if (callback)
          callback();
      }).catch((err) => {
        console.error("Encountered an error loading the manifestUrl", err);
        alert("failed to load the media manifest, could not play this file.");
      });
    });
  }

  render() {
    return (
      <div className="shakaContainer" data-shaka-player-container data-shaka-player-cast-receiver-id="07AEE832" ref={this.videoContainer}>
        <video data-shaka-player autoPlay playsInline ref={this.videoComponent}>
        </video>
      </div>
    )
  }
}

export default Player;
