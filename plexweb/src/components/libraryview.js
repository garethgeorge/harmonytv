// presents a view of a given library
import React from "react";
import {getLibraryManager, createLobbyWithMedia} from "../model/model";
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

    // sort the episodes by name :P 
    curSeries.sort((a, b) => {
      return (a.seasonnumber * 1000 + a.episodenumber) - (b.seasonnumber * 1000 + b.episodenumber);
    });

    const zeroPad = (num) => {
      const s = "00" + num;
      return s.substr(s.length - 2);
    }

    const episodes = [];
    for (const episode of curSeries) {
      const doClick = () => {
        createLobbyWithMedia(episode.mediaid).then(lobbyid => {
          window.location.href = "/lobby/" + lobbyid;
        });
      }

      episodes.push(
        <div className="episode" key={episode.mediaid}>
          <a href="#" onClick={doClick}>
            {episode.name}

            <span>S{zeroPad(episode.seasonnumber)}E{zeroPad(episode.episodenumber)}</span>
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