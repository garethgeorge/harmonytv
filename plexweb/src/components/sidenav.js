import React from "react";
import {getLibraryManager} from "../model/model";
import { Link } from "react-router-dom";

class SideNav extends React.Component {
  state = {}

  constructor(props) {
    console.log("constructed SideNav");
    super(props);
  }

  componentDidMount() {
    getLibraryManager().then(manager => {
      this.setState({
        manager: manager,
      });
    });
  }

  render() {
    if (!this.state.manager) {
      return <div></div>
    }

    const links = [];
    for (const libraryObj of Object.values(this.state.manager.libraries)) {
      const library = libraryObj.library;

      const selected = window.location.href.indexOf(library.libraryid) !== -1;
      links.push(
        <Link key={library.libraryid} 
          className={selected ? "selected" : ""} 
          to={"/library/" + library.libraryid}
          onClick={() => {
            setImmediate(() => {
              this.forceUpdate();
            });
          }}
          >{library.libraryname}</Link>
      )
    }

    return (
      <div className="sidenav">
        <span style={{
          color: "grey",
          fontSize: "1.5em",
          padding: "15px",
        }}>MyPlex</span>
        {links}
      </div>
    )
  }
}

export default SideNav;