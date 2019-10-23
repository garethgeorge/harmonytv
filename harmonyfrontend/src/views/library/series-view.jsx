import React from "react";
import {autorun} from "mobx";
import {observer} from "mobx-react";
import model from "../../model";
import EpisodeTV from "../../components/library/episode-tv";

export default observer(class SeriesView extends React.Component {
  state = {};
  
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    // always refresh resume watching
    model.user.refreshResumeWatchingList();

    if (!model.state.libraries)
      model.library.refreshLibraries();

    this._mobx_disposer = autorun(() => {
      if (!model.state.libraries) return ;
      const library = model.state.libraries[this.props.libraryid];
      if (!library.media)
        setImmediate(() => {
          library.refreshMediaList();
        });

      if (library) {
        // update breadcrumbs 
        model.state.breadcrumbs = [
          {
            text: library.name,
            href: "/library/" + library.id 
          },
          {
            text: this.props.seriesName,
            href: "/library/" + library.id + "/series/" + this.props.seriesName
          }
        ];
      } else {
        model.state.breadcrumbs = []
      }
    });
  }

  componentWillUnmount() {
    this._mobx_disposer();
  }

  render() {
    if (!model.state.libraries) return null;
    if (!model.state.libraries[this.props.libraryid]) return null;
    
    const library = model.state.libraries[this.props.libraryid];
    if (!library.series) return null;
    const series = library.series[this.props.seriesName];
    if (!series) {
      return <p>SERIES NOT FOUND {this.props.seriesName}</p>
    }

    // sort the episodes by name :P 
    series.sort((a, b) => {
      return (a.seasonnumber * 1000 + a.episodenumber) - (b.seasonnumber * 1000 + b.episodenumber);
    });


    const episodes = [];
    for (const episode of series) {
      // TODO: split out 'episode' into its own JSX component 
      episodes.push(
        <EpisodeTV key={episode.mediaid} episode={episode} />
      )
    }
    
    return (
      <div>
        <div style={{margin: "10px"}}>Episodes</div>
        {episodes}
      </div>
    )
  }
});