import React from "react";
import config from "../config";
import {getMedia} from "../model/model";
import "./player.css";

// https://shaka-player-demo.appspot.com/docs/api/tutorial-ui.html
let shakaUiLoaded = false;
document.addEventListener('shaka-ui-loaded', () => {
  shakaUiLoaded = true;
});

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
          console.log("\tadding subtitle language: " + language);

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
            {/* <source src={fallbackUrl} type="video/mp4"></source> */}
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

export default Player;
