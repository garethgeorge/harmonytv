import React from "react";
import config from "../config";
import {getMediaInfo} from "../model/model";
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
      
    const ui = new shaka.ui.Overlay(player, videoContainer, video);
    ui.getControls();

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

    getMediaInfo(mediaid).then(media => {
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
      <div className="shakaContainer" ref={this.videoContainer}>
        <video ref={this.videoComponent}>
        </video>
      </div>
    )
  }
}




// https://shaka-player-demo.appspot.com/docs/api/tutorial-ui.html
// let shakaUiLoaded = false;
// document.addEventListener('shaka-ui-loaded', () => {
//   shakaUiLoaded = true;
// });





/*
class Player extends React.Component {
  state = {}
  
  isDashSupported() {
    const shaka = window.shaka;
    return window.MediaSource && shaka.Player.isBrowserSupported();
  }

  installShaka(videoElem) {
    console.log("installing shaka on element: ", videoElem);
    this.videoElem = videoElem;

    const shaka = window.shaka;
    if (this.isDashSupported()) {
      shaka.polyfill.installAll();
      
      const ui = videoElem['ui'];
      const controls = ui.getControls();
      const player = controls.getPlayer();

      player.addEventListener('error', (error) => {
        console.error("Shaka player error code ", error.detail.code, " object ", error);
      });
      
      // use to contorl the network connection
      // const nwEngine = player.getNetworkingEngine();

      this.shakaPlayer = player;
      this.shakaUi = ui;
    } else {
    }
  }

  playVideo(mediaid, callback=null) {
    console.log("Player::playVideo(" + mediaid + ")");

    if (!this.shakaPlayer) {
      const fallbackUrl = config.apiHost + "/media/" + mediaid + "/files/fallback.mp4";
      this.videoElem.src = fallbackUrl;
      return ;
    }

    getMedia(mediaid).then(media => {
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
      }); 

    });
  }

  render() {
    const onVideoRef = (elem) => {
      if (elem === null) return ;
      const retry = () => {
        if (!shakaUiLoaded)
          return setTimeout(retry, 50);
        this.installShaka(elem);
      }
      retry();
    } 

    // if (this.isDashSupported()) {
      return (
        <div className="shakaContainer" data-shaka-player-container data-shaka-player-cast-receiver-id="7B25EC44">
          <video data-shaka-player ref={onVideoRef}>
          </video>
        </div>
      );
    // } else {
    //   return (
    //     <div className="shakaContainer">
    //       <video controls autoPlay={true} ref={onVideoRef}></video>;
    //     </div>
    //   )
    // }
  }
}
*/

export default Player;
