import React from "react";
import { observer } from "mobx-react";

export default class ChatChunk {
  constructor(data) {
    this.data = data;
    this.lines = [];
    this.open = true;
  }

  addLine(line) {
    if (this.open) {
      this.lines.push(line);
    } else {
      console.log('tried to add to a closed chunk');
    }
  }

  open() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  renderLine(line) {
    return (
      <div className="chunk-line">
      
      </div>
    );
  }

  render() {

  }
});
