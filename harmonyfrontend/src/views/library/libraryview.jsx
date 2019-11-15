import React from "react";
import SeriesList from "../../components/library/series-list";
import MoviesList from "../../components/library/movies-list";

import model from "../../model";
import { autorun } from "mobx";
import { observer } from "mobx-react";

export default observer(
  class LibraryView extends React.Component {
    state = {};

    componentDidMount() {
      if (!model.state.libraries) model.library.refreshLibraries();

      this._mobx_disposer = autorun(() => {
        if (!model.state.libraries) return;
        const library = model.state.libraries[this.props.libraryid];

        if (library) {
          // update breadcrumbs
          model.state.breadcrumbs = [
            {
              text: library.name,
              href: "/library/" + library.id
            }
          ];

          // library.refreshMediaList();
        } else {
          model.state.breadcrumbs = [];
        }
      });
    }

    componentWillUnmount(prevProps, newProps) {
      if (!prevProps || prevProps.library !== newProps.library)
        this._mobx_disposer();
    }

    render() {
      if (!model.state.libraries) return null;
      const library = model.state.libraries[this.props.libraryid];

      if (!library) {
        return <h1>LIBRARY {this.props.libraryid} NOT FOUND</h1>;
      } else {
        if (library.type === "tv") {
          return (
            <div className="libraryView">
              <SeriesList library={library} />
            </div>
          );
        } else {
          return (
            <div className="libraryView">
              <MoviesList library={library} />
            </div>
          );
        }
      }
    }
  }
);
