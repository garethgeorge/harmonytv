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
  
  constructor(props) {
    super(props);
    console.log("LOADING PLAYER WITH MEDIA ID: " + props.mediaid);
  }

  componentDidMount() {
    getMedia(this.props.mediaid).then(media => {
      console.log("MEDIA INFO: " + JSON.stringify(media));
      this.setState({
        media: media
      });
    });
  }

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

      const nwEngine = player.getNetworkingEngine(); // does nothing with it at the moment
      // see https://shaka-player-demo.appspot.com/docs/api/shaka.extern.html#.RequestFilter
      // can use this to inject encryption headers and virtually everything else needed wowza
      // this is freaking perfect 

      const manifestUrl = config.apiHost + "/media/" + this.props.mediaid + "/files/stream.mpd";

      player.load(manifestUrl).then(() => {
        console.log('The video has now been loaded!');
        
        const metadata = this.state.media.metadata;
        console.log("VIDEO METADATA: " + JSON.stringify(metadata));

        console.log("loading subtitles");
        for (const language of Object.keys(metadata.subtitles)) {
          const subtitle = metadata.subtitles[language];
          console.log("\tadding subtitle language: " + language);

          player.addTextTrack(
            config.apiHost + "/media/" + this.props.mediaid + "/files/" + subtitle.file, 
            language, "captions", "text/vtt"
          );
        }
      }).catch((err) => {
        console.error("Encountered an error loading the manifestUrl", err);
      }); 
    } else {
      alert("Browser not supported by shaka player");
    }
  }

  render() {
    const fallbackUrl = config.apiHost + "/media/" + this.props.mediaid + "/files/fallback.mp4";

    const onVideoRef = (elem) => {
      if (elem === null) return ;
      const retry = () => {
        if (!shakaUiLoaded || !this.state.media)
          return setTimeout(retry, 50);
        this.installShaka(elem);
      }
      retry();
    }

    return (
      <div className="shaka" data-shaka-player-container data-shaka-player-cast-receiver-id="7B25EC44">
        <video data-shaka-player ref={onVideoRef} autoPlay style={{width: '100%', height: '100%'}}>
          <source src={fallbackUrl} type="video/mp4"></source>
        </video>
      </div>
    )
  }
}

export default Player;