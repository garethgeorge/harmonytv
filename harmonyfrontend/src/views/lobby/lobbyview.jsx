import React from "react";
import io from "socket.io-client";
import Player from "../../components/lobby/player/player";
import model from "../../model/";
import config from "../../config";
import "./lobbyview.scss";
import ChatBox from "../../components/lobby/chatbox/chatbox";

class Lobby extends React.Component {
  state = {};

  constructor(props) {
    super(props);
    console.log("Lobby::constructor - lobbyid: " + props.lobbyid);
    model.state.lobbyid = props.lobbyid;

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
