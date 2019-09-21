import React from "react";
import config from "../config";
import "./player.css";
import {getMedia} from "../model/model";

// https://shaka-player-demo.appspot.com/docs/api/tutorial-ui.html
let shakaUiLoaded = false;
document.addEventListener('shaka-ui-loaded', () => {
  shakaUiLoaded = true;
});

class Player extends React.Component {
  state = {}
  
  installShaka(videoElem) {
    console.log("installing shaka on element: ", videoElem);
    const shaka = window.shaka;

    shaka.polyfill.installAll();
    if (shaka.Player.isBrowserSupported()) {
      const ui = videoElem['ui'];
      const controls = ui.getControls();
      const player = controls.getPlayer();

      player.addEventListener('error', (error) => {
        console.error("Shaka player error code ", error.detail.code, " object ", error);
      });
      
      // use to contorl the network connection
      // const nwEngine = player.getNetworkingEngine();

      this.videoElem = videoElem;
      this.shakaPlayer = player;
      this.shakaUi = ui;
    } else {
      alert("Browser not supported by shaka player");
    }
  }

  playVideo(mediaid, callback=null) {
    console.log("Player::playVideo(" + mediaid + ")");

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
    // const fallbackUrl = config.apiHost + "/media/" + this.props.mediaid + "/files/fallback.mp4";

    const onVideoRef = (elem) => {
      if (elem === null) return ;
      const retry = () => {
        if (!shakaUiLoaded)
          return setTimeout(retry, 50);
        this.installShaka(elem);
      }
      retry();
    }

    return (
      <div className="shaka" data-shaka-player-container data-shaka-player-cast-receiver-id="7B25EC44">
        <video data-shaka-player ref={onVideoRef} autoPlay style={{width: '100%', height: '100%'}}>
          {/* <source src={fallbackUrl} type="video/mp4"></source> */}
        </video>
      </div>
    )
  }
}

export default Player;
