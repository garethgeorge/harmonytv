import React from "react";
import { observer } from "mobx-react";

export default observer(
  class ChatboxDocumentation extends React.Component {
    constructor(props) {
      super(props);
    }

    render() {
      return (
        <div>
          We can put fully formatted and interactive chat documentation here.
        </div>
      );
    }
  }
);
