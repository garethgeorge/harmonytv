import React from "react";
import { Route } from "react-router-dom";
import LibraryView from "./libraryview";
import SeriesView from "./series-view";
import { observer } from "mobx-react";
import BreadCrumbs from "../../components/breadcrumbs";
import model from "../../model";

export default observer(() => {
  return (
    <div>
      <Route
        path={`/library/:libraryid/series/:seriesname`}
        component={observer(props => {
          return (
            <div>
              <BreadCrumbs breadcrumbs={model.state.breadcrumbs} />
              <SeriesView
                libraryid={props.match.params.libraryid}
                seriesName={props.match.params.seriesname}
              />
            </div>
          );
        })}
      />
      <Route
        exact
        path={`/library/:libraryid`}
        component={observer(props => {
          return (
            <div>
              <BreadCrumbs breadcrumbs={model.state.breadcrumbs} />
              <LibraryView libraryid={props.match.params.libraryid} />
            </div>
          );
        })}
      />
    </div>
  );
});
