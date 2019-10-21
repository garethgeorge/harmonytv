// presents a view of a given library
import React from "react";
import * as model from "../model/model";
import "./libraryview.css";
import { Route, Link } from "react-router-dom";

/*
  component used in LibraryView to show a list of series 
*/

class EpisodeComponent extends React.Component {
  render() {
    const episode = this.props.episode;
    const progress = this.props.progress;

    const doClick = () => {
      model.createLobbyWithMedia(episode.mediaid).then(lobbyid => {
        window.location.href = "/lobby/" + lobbyid;
      });
    }

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
        <div className={completed ? "episode episode-watched" : "episode"} key={episode.mediaid}>
          <div className="inner">
            <a href="#" onClick={doClick}>
              <span>S{zeroPad(episode.seasonnumber)}E{zeroPad(episode.episodenumber)}</span>
              {episode.name}
            </a>
          </div>
          {progressBar}
        </div>
      </div>
    );
  }
}

class SeriesView extends React.Component {
  state = {};
  
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    (async () => {
      const manager = await model.getLibraryManager();
      const library = manager.getLibraryById(this.props.match.params.libraryid);
      const series = await library.getSeries(this.props.match.params.seriesid);

      this.setState({
        library: library,
        series: series 
      });

      // add resume watching to the state :P
      const state = Object.assign({}, this.state);
      state.resumewatching = {};
      const resumewatching = (await model.user.listResumeWatching());
      console.log("resume watching... ", resumewatching);
      resumewatching.forEach((show) => {
        state.resumewatching[show.mediaid] = show;
      });
      this.setState(state);
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


    const episodes = [];
    for (const episode of curSeries) {
      
      
      // TODO: split out 'episode' into its own JSX component 
      if (this.state.resumewatching && this.state.resumewatching[episode.mediaid]) {
        const resumewatching = this.state.resumewatching[episode.mediaid];
        episodes.push(
          <EpisodeComponent episode={episode} progress={resumewatching} />
        )
      } else {
        episodes.push(
          <EpisodeComponent episode={episode} progress={null} />
        )
      }
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
    model.getLibraryManager().then(manager => {
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