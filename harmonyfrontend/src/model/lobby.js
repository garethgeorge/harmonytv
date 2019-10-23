import axios from "axios";
import config from "../config";

export default {
  create: async (mediaid) => {
    const res = await axios.get(config.apiHost + "/lobby/create?mediaid=" + mediaid);
    console.log("created lobby playing media: " + mediaid + " lobbyid: " + res.data.lobbyId);
    return res.data.lobbyId;
  }
}