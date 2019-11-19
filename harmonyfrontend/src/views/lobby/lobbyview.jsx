import React from "react";
import io from "socket.io-client";
import Player from "../../components/lobby/player";
import model from "../../model/";
import config from "../../config";
import "./lobbyview.scss";
import ChatBox from "../../components/lobby/chatbox";

let delta = 0;

const curTimeMilliseconds = () => {
  return new Date().getTime() + delta;
};

class NowPlaying {
  constructor(nowPlaying) {
    this.nowPlaying = nowPlaying;
  }

  getMediaID() {
    return this.nowPlaying.mediaid;
  }

  getPlaybackPosition() {
    const nowPlaying = this.nowPlaying;
    if (nowPlaying.state === "playing") {
      // return ((new Date).getTime() - nowPlaying.updateTime + delta) / 1000 + nowPlaying.position;
      return (
        (curTimeMilliseconds() - nowPlaying.updateTime) / 1000 +
        nowPlaying.position
      );
    } else return nowPlaying.position;
  }

  isSame(other) {
    return (
      Math.abs(this.getPlaybackPosition() - other.getPlaybackPosition()) < 5 &&
      this.nowPlaying.state === other.nowPlaying.state
    );
  }

  apply(player) {
    if (this.nowPlaying.state == "paused") {
      console.log("\tattempting to pause video");
      player.pause();
    } else if (this.nowPlaying.state == "playing") {
      console.log("\tattempting to play video");
      player.play();
    }
    console.log("SETTING player.currentTime = " + this.getPlaybackPosition());
    player.currentTime = this.getPlaybackPosition();
  }
}

class Lobby extends React.Component {
  state = {};

  constructor(props) {
    super(props);
    console.log("Lobby::constructor - lobbyid: " + props.lobbyid);

    this.socket = io(config.host + "/lobbyns");
    this.socket.on("error", console.error);
    console.log("\tlobby connecting to socket: " + config.apiHost + "/lobbyns");
    // this.socket.connect(config.apiHost);
    this.player = React.createRef();
  }

  componentDidMount() {
    // initialize the sync
    console.log("broadcasting client:join-lobby " + this.props.lobbyid);
    this.socket.emit("client:join-lobby", this.props.lobbyid);

    this.syncTeardown = model.lobby.syncVideoWithLobby(
      this.socket,
      this.player.current
    );
  }

  componentWillUnmount() {
    this.syncTeardown();
  }

  render() {
    console.log("rendering the video player...");

    this.chatbox = <ChatBox socket={this.socket} />;

    return (
      <div className="lobbyview">
        <Player ref={this.player} />
        {this.chatbox}
      </div>
    );
  }
}

export default Lobby;
