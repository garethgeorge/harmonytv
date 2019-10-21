import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
// import SideNav from "./components/sidenav";
import "./App.css";
import LibraryView from "./components/libraryview";
import LoginView from "./components/loginview";
import model from "./model/";
import {observer} from "mobx-react";

// const Lobby = React.lazy(() => import("./components/lobbyview")); 

// const lobbyPage = (props) => {
//   const lobbyid = props.match.params.lobbyid;
//   return (
//     <React.Suspense fallback={<div>Loading...</div>}>
//       <Lobby lobbyid={lobbyid} />
//     </React.Suspense>
//   )
// }

const App = observer(class App extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    model.user.getCurrentUser(); 
  }

  render() {
    const content = [];
    for (let x = 0; x < 1000; ++x) {
      content.push(<p>TEST</p>);
    }

    if (!model.state.user) {
      return (
        <div className="absolute-center-content">
          <LoginView />
        </div>
      );
    }
    
    return <h1>TEST TEST TEST</h1>

    return (
      <Router basename="/web">
        <Switch> {/* iterates its children and takes the first that matches */}
          {/* <Route path={`/player/:mediaid`} component={playerPage} /> */}
          {/* <Route path={`/lobby/:lobbyid`} component={lobbyPage} /> */}
          <Route path={`/`}>
            <div className="App">
              <div className="sidenav-container">
                <SideNav />
              </div>
              
              <div className="content-container">
                <Route path={`/library/:libraryid`} component={LibraryView} />
              </div>
            </div>
          </Route>
        </Switch>
      </Router>
    );
  }
});

export default App;