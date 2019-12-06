import React from "react";
import model from "../../model";
import { Link } from "react-router-dom";
import { observer } from "mobx-react";
import Loading from "../../components/loading";
import "./library.scss";
import sortableTitle from "./titlesort";

export default observer(
  class SeriesList extends React.Component {
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
        if (newWidth != this.state.width)
          this.setState({
            width: newWidth,
          });
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
      const series = this.props.library.series;
      if (!this.props.library.series || !this.props.library.media) {
        return <Loading />;
      }

      let seriesTitles = Object.keys(series).sort((a, b) => {
        return sortableTitle(a) > sortableTitle(b) ? 1 : -1;
      });

      const shows = [];
      for (const seriesName of seriesTitles) {
        shows.push(
          <Link
            key={seriesName}
            className="show"
            to={
              "/library/" +
              this.props.library.name +
              "/series/" +
              encodeURIComponent(seriesName)
            }
            style={{ width: this.state.width + "px" }}
          >
            <div className="inner">
              <div>
                {seriesName} <span>{series[seriesName].length} episodes</span>
              </div>
            </div>
          </Link>
        );
      }

      return (
        <div
          className="seriesList"
          ref={(elem) => {
            this.container = elem;
            this.resizeHook();
          }}
        >
          {shows}
        </div>
      );
    }
  }
);
