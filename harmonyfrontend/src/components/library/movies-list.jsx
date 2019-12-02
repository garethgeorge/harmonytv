import React from "react";
import model from "../../model";
import { observer } from "mobx-react";
import Loading from "../../components/loading";
import Movie from "./movie";
import "./library.scss";

export default observer(
  class MoviesList extends React.Component {
    state = {
      width: 400,
    };

    constructor(props) {
      super(props);
      this.container = null;

      this.resizeHook = () => {
        if (!this.container) return;
        const canFitCount = Math.floor(this.container.clientWidth / 400);
        const newWidth = this.container.clientWidth / canFitCount - 15;
        if (newWidth != this.state.width) {
          this.setState({
            width: newWidth,
          });
        }
      };
    }

    componentDidMount() {
      window.addEventListener("resize", this.resizeHook);

      if (!this.props.library.series) this.props.library.refreshMediaList();
    }

    componentDidUpdate() {
      // always refresh resume watching
      model.user.refreshResumeWatchingList();

      if (!this.props.library.series) this.props.library.refreshMediaList();
    }

    componentWillUnmount() {
      window.removeEventListener("resize", this.resizeHook);
    }

    render() {
      if (!this.props.library.media) {
        return <Loading />;
      }

      const media = [...this.props.library.media];

      media.sort((a, b) => {
        return a.name > b.name ? 1 : -1;
      });

      const movies = [];
      for (const mediaItem of media) {
        movies.push(
          <Movie
            key={mediaItem.mediaid}
            movie={mediaItem}
            style={{ width: this.state.width + "px" }}
          />
        );
      }

      return (
        <div
          className="moviesList"
          ref={(elem) => {
            this.container = elem;
            this.resizeHook();
          }}
        >
          {movies}
        </div>
      );
    }
  }
);
