import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import SideNav from "./components/sidenav";
import "./App.scss";
import "./fonts.scss";
import LibraryRouter from "./views/library/libraryrouter";
import LoginView from "./views/login-view";
import model from "./model";
import { observer } from "mobx-react";
import Loading from "./components/loading";
import config from "./config";

const Lobby = React.lazy(() => import("./views/lobby/lobbyview"));

const lobbyPage = (props) => {
  const lobbyid = props.match.params.lobbyid;
  return (
    <React.Suspense fallback={<Loading />}>
      <Lobby lobbyid={lobbyid} />
    </React.Suspense>
  );
};

const FullRouter = () => {
  return (
    <Router basename="/">
      <Switch>
        {/* iterates its children and takes the first that matches */}
        {/* <Route path={`/player/:mediaid`} component={playerPage} /> */}
        <Route path={`/lobby/:lobbyid`} component={lobbyPage} />

        <Route path={`/`}>
          <div className="App">
            <div className="sidenav-container">
              <SideNav />
            </div>

            <div className="content-container">
              <Route path={`/library/:libraryid`} component={LibraryRouter} />
            </div>
          </div>
        </Route>
      </Switch>
    </Router>
  );
};

const App = observer(
  class App extends React.Component {
    state = {
      loading: true,
    };
    componentDidMount() {
      model.user.getCurrentUser().then(() => {
        this.setState({ loading: false });
      });
      (function() {
        if (config.development) {
          var link =
            document.querySelector("link[rel*='icon']") ||
            document.createElement("link");
          link.type = "image/x-icon";
          link.rel = "shortcut icon";
          link.href = "devlogo512.png";
          document.getElementsByTagName("head")[0].appendChild(link);
        }
      })();
    }

    render() {
      if (this.state.loading) return <Loading />;

      // block the view by rendering the login screen
      if (!model.state.user) {
        return <LoginView />;
      }

      return <FullRouter />;
    }
  }
);

export default App;
