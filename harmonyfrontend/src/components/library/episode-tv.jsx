import React from "react";
import { observer } from "mobx-react";
import model from "../../model/";

import "./library.scss";
import MetadataTags from "./metadata-tags";

export default observer(
  class EpisodeTV extends React.Component {
    onClick() {
      const episode = this.props.episode;
      model.lobby.create(episode.mediaid).then((lobbyid) => {
        window.location.href = "/lobby/" + lobbyid;
      });
    }

    render() {
      const episode = this.props.episode;
      const progress = model.state.resumeWatching[this.props.episode.mediaid];

      const zeroPad = (num) => {
        const s = "00" + num;
        return s.substr(s.length - 2);
      };

      const completed =
        progress &&
        progress.position >
          Math.max(
            progress.total_duration * 0.8,
            progress.total_duration - 5 * 60
          );
      const progressBar =
        !completed && progress && progress.position > 120 ? (
          <div className="progress-bar-wrapper">
            <div
              className="progress-bar"
              style={{
                width:
                  (progress.position / progress.total_duration) * 100.0 + "%",
              }}
            ></div>
          </div>
        ) : null;

      return (
        <div>
          <div
            className={completed ? "episode-tv watched" : "episode-tv"}
            key={episode.mediaid}
          >
            <a href="#" onClick={this.onClick.bind(this)}>
              <div className="inner">
                <span>
                  S{zeroPad(episode.seasonnumber)}E
                  {zeroPad(episode.episodenumber)}
                </span>
                {episode.name}
                <MetadataTags metadata={episode.metadata} />
              </div>
            </a>
            {progressBar}
          </div>
        </div>
      );
    }
  }
);
