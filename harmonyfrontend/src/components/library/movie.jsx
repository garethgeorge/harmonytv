import React from "react";
import {observer} from "mobx-react";
import model from "../../model/";

import "./library.css";
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
      <div className="movie-progress-bar" style={{width: (progress.position / progress.total_duration * 100.0) + '%' }}></div>
    ) : null;

    return (
      <div>
        <div className={completed ? "movie movie-watched" : "movie"} key={movie.mediaid}>
          <div className="inner">
            <a href="#" onClick={this.onClick.bind(this)}>
              {movie.name}
            </a>
            <MetadataTags metadata={movie.metadata} />
          </div>
          {progressBar}
        </div>
      </div>
    );
  }
});
