import React from "react";
import { observer } from "mobx-react";
import model from "../../model/";

import "./library.scss";
import MetadataTags from "./metadata-tags";

export default observer(class Movie extends React.Component {
  onClick() {
    const movie = this.props.movie;
    model.lobby.create(movie.mediaid).then(lobbyid => {
      window.location.href = "/lobby/" + lobbyid;
    });
  }

  render() {
    const movie = this.props.movie;
    const progress = model.state.resumeWatching[movie.mediaid];

    const completed = progress && progress.position > Math.max(progress.total_duration * 0.8, progress.total_duration - 5 * 60);
    const progressBar = (!completed && progress && progress.position > 120) ? (
      <div className="progress-bar-wrapper">
        <div className="progress-bar" style={{ width: (progress.position / progress.total_duration * 100.0) + '%' }}></div>
      </div>
    ) : null;

    console.log(JSON.stringify(this.props.style));

    return (
      <div className={completed ? "movie watched" : "movie"} key={movie.mediaid} style={this.props.style}>
        <a href="#" onClick={this.onClick.bind(this)}>
          <div className="inner">
            {movie.name}
            <MetadataTags metadata={movie.metadata} />
          </div>
        </a>
        {progressBar}
      </div>
    );
  }
});
