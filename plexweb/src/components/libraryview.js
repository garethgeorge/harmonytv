// presents a view of a given library
import React from "react";
import {getLibraryManager} from "../model/model";
import "./libraryview.css";
import { Route, Link } from "react-router-dom";

/*
  component used in LibraryView to show a list of series 
*/
class SeriesView extends React.Component {
  state = {};
  
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    (async () => {
      const manager = await getLibraryManager();
      const library = manager.getLibraryById(this.props.match.params.libraryid);
      const series = await library.getSeries(this.props.match.params.seriesid);

      this.setState({
        library: library,
        series: series 
      })
    })();
  }

  render() {
    if (!this.state.series) {
      return <h1></h1>
    }

    const breadcrumbs = (
      <nav className="ink-navigation">
        <ul className="breadcrumbs black">
          <li><Link to={"/library/" + this.props.match.params.libraryid}>{this.state.library.library.libraryname}</Link></li>
          <li className="active"><a href="#">{this.props.match.params.seriesid}</a></li>
        </ul>
      </nav>
    );

    const seriesId = this.props.match.params.seriesid;
    const curSeries = this.state.series[seriesId];
    if (!curSeries) {
      return <h1>Error: series not found</h1>
    }

    const episodes = [];
    for (const episode of curSeries) {
      episodes.push(
        <div className="episode">
          <a href={"/player/" + episode.mediaid}>
            {episode.name}
          </a>
        </div>
      )
    }
    
    return (
      <div>
        {breadcrumbs}
        <div style={{margin: "10px"}}>Episodes</div>
        {episodes}
      </div>
    )
  }
}


class SeriesList extends React.Component {
  state = {};

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.props.library.getSeries().then(series => {
      this.setState({
        series: series 
      });
    });
  }

  render() {
    if (!this.state.series)
      return <p></p>

    const libraryid = this.props.library.library.libraryid;

    const shows = [];
    for (const seriesName of Object.keys(this.state.series)) {
      shows.push(
        <Link key={seriesName} className="show" to={"/library/" + libraryid + "/series/" + encodeURIComponent(seriesName)} >
          <div>{seriesName}</div>
          <span>{this.state.series[seriesName].length} episodes</span>
        </Link>
      )
    }

    return (
      <div className="seriesList">
        {shows}
      </div>
    )
  }
};

class LibraryView extends React.Component {
  state = {};

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    getLibraryManager().then(manager => {
      this.setState({
        manager: manager 
      });
    });
  }

  render() {
    if (!this.state.manager) {
      return <h1></h1>
    } else {
      const libraryid = this.props.match.params.libraryid;
      const libraryObj = this.state.manager.getLibraryById(libraryid);
      if (libraryObj.library.librarytype === "tv") {
        return (
          <div className="libraryView">
            <nav className="ink-navigation">
              <ul className="breadcrumbs black">
                <li className="active"><a href="#">{libraryObj.library.libraryname}</a></li>
              </ul>
            </nav>
            <SeriesList library={libraryObj} />
          </div>
        )
      } else {
        // throw new Error("unsupported library type: " + JSON.stringify(libraryObj.library));
        return <div></div>
      }
    }
  }
}


export default (props) => {
  const libraryid = props.match.params.libraryid;
  return (
    <div>
      <Route path={`/library/:libraryid/series/:seriesid`} component={SeriesView} />
      <Route
          exact
          path={`/library/:libraryid`}
          component={LibraryView}
        />
    </div>
  )
};