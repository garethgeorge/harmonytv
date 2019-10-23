import React from "react";
import { Link } from "react-router-dom";
import {action} from "mobx";
import {observer} from "mobx-react";
import "./series-list.css";

export default observer(class SeriesList extends React.Component {
  componentDidMount() {
    if (!this.props.library.series)
      this.props.library.refreshMediaList();
  }
  componentDidUpdate() {
    if (!this.props.library.series)
      this.props.library.refreshMediaList();
  }

  render() {
    const series = this.props.library.series;
    if (!this.props.library.series || !this.props.library.media) {
      return <p>LOADING...</p>
    }

    const shows = [];
    for (const seriesName of Object.keys(series)) {
      shows.push(
        <Link key={seriesName} className="show" to={"/library/" + this.props.library.id + "/series/" + encodeURIComponent(seriesName)} >
          <div>{seriesName}</div>
          <span>{series[seriesName].length} episodes</span>
        </Link>
      );
    }

    return (
      <div className="seriesList">
        {shows}
      </div>
    );
  }
});