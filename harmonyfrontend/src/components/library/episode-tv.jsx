import React from "react";
import {observer} from "mobx-react";
import model from "../../model/";

import "./episode-tv.css";

export default observer(class EpisodeTV extends React.Component {
  onClick() {
    const episode = this.props.episode;
    model.lobby.create(episode.mediaid).then(lobbyid => {
      window.location.href = "/lobby/" + lobbyid;
    });
  }
  
  render() {
    const episode = this.props.episode;
    const progress = model.state.resumeWatching[this.props.episode.mediaid];

    const zeroPad = (num) => {
      const s = "00" + num;
      return s.substr(s.length - 2);
    }

    const completed = progress && progress.position > Math.max(progress.total_duration * 0.8, progress.total_duration - 5 * 60);
    const progressBar = (!completed && progress) ? (
      <div className="episode-progress-bar" style={{width: (progress.position / progress.total_duration * 100.0) + '%' }}></div>
    ) : null;

    return (
      <div>
        <div className={completed ? "episode-tv episode-tv-watched" : "episode-tv"} key={episode.mediaid}>
          <div className="inner">
            <a href="#" onClick={this.onClick.bind(this)}>
              <span>S{zeroPad(episode.seasonnumber)}E{zeroPad(episode.episodenumber)}</span>
              {episode.name}
            </a>
          </div>
          {progressBar}
        </div>
      </div>
    );
  }
});