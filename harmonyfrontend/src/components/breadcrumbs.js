import React from "react";
import {observer} from "mobx-react";
import { Link } from "react-router-dom";

export default observer((props) => {
  const divs = [];
  for (const idx in props.breadcrumbs) {
    const seg = props.breadcrumbs[idx];
    if (idx == props.breadcrumbs.length - 1) {
      divs.push(
        <li className="active" key={seg.href}><a>{seg.text}</a></li>
      );
    } else {
      divs.push(
        <li><Link to={seg.href} key={seg.href}>{seg.text}</Link></li>
      );
    }
  }

  return (
    <nav className="ink-navigation">
      <ul className="breadcrumbs black">
        {divs}
      </ul>
    </nav>
  )
})