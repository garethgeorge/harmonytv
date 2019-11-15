import React from "react";
import model from "../../model";
import { observer } from "mobx-react";
import Loading from "../../components/loading";
import Movie from "./movie";
import "./library.scss";

export default observer(class MoviesList extends React.Component {
  componentDidMount() {
    // always refresh resume watching
    model.user.refreshResumeWatchingList();

    if (!this.props.library.series)
      this.props.library.refreshMediaList();
  }
  componentDidUpdate() {
    if (!this.props.library.series)
      this.props.library.refreshMediaList();
  }

  render() {
    if (!this.props.library.media) {
      return <Loading />
    }

    const media = [...this.props.library.media];

    media.sort((a, b) => {
      return (a.name > b.name) ? 1 : -1;
    });

    const movies = [];
    for (const mediaItem of media) {
      movies.push(<Movie key={mediaItem.mediaid} movie={mediaItem} />)
    }

    return (
      <div className="moviesList">
        {movies}
      </div>
    );
  }
});