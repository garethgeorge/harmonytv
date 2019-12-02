import React, { Children } from "react";
import ReactDOM from "react-dom";
import config from "../../../config";
import model from "../../../model";
import { observer } from "mobx-react";
import "./player.scss";

import "shaka-player/dist/controls.css";
const shaka = require("shaka-player/dist/shaka-player.ui.js");
const debug = require("debug")("components:lobby:player");

class SkipButton extends shaka.ui.Element {
  constructor(parent, controls) {
    super(parent, controls);

    this.elem = document.createElement("div");

    const SkipButton = observer(
      class SkipButton extends React.Component {
        render() {
          if (!model.state.videoQueue || model.state.videoQueue.length <= 1)
            return null;

          return (
            <button
              style={{
                border: "none",
                background: "none",
                paddingTop: "4px",
              }}
            >
              <i
                className="material-icons md-light"
                style={{ fontSize: "24px" }}
              >
                skip_next
              </i>
            </button>
          );
        }
      }
    );

    ReactDOM.render(<SkipButton />, this.elem);
    this.parent.appendChild(this.elem);

    this.eventManager.listen(this.elem, "click", () => {
      model.lobby.playNextInQueue().catch(alert);
    });
  }

  static create(rootElement, controls) {
    return new SkipButton(rootElement, controls);
  }
}

class MyFullscreen extends shaka.ui.Element {
  constructor(parent, controls) {
    super(parent, controls);

    this.elem = document.createElement("div");

    const FSButton = observer(
      class FSButton extends React.Component {
        state = {
          fullscreen: false,
        };
        constructor(props) {
          super(props);
          document.addEventListener("fullscreenchange", (event) => {
            this.setState({ fullscreen: document.fullscreenElement });
          });
        }
        render() {
          return (
            <button
              style={{
                border: "none",
                background: "none",
                paddingTop: "4px",
              }}
            >
              <i
                className="material-icons md-light"
                style={{ fontSize: "24px" }}
              >
                {!this.state.fullscreen ? "fullscreen" : "fullscreen_exit"}
              </i>
            </button>
          );
        }
      }
    );

    const button = <FSButton />;
    ReactDOM.render(button, this.elem);
    this.parent.appendChild(this.elem);

    this.eventManager.listen(this.elem, "click", () => {
      const elem = document.getElementById("root") || document.documentElement;
      if (
        !document.fullscreenElement &&
        !document.mozFullScreenElement &&
        !document.webkitFullscreenElement &&
        !document.msFullscreenElement
      ) {
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
    });
  }

  static create(rootElement, controls) {
    return new MyFullscreen(rootElement, controls);
  }
}

export default () => {
  shaka.ui.Controls.registerElement("skip", SkipButton);
  shaka.ui.Controls.registerElement("myfullscreen", MyFullscreen);
};
