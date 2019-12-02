import axios from "axios";
import state from "./state";
import model from ".";
import { action } from "mobx";
import config from "../config";
const debug = require("debug")("model:user");

const exports = {
  getCurrentUser: async () => {
    if (state.user !== null) return state.user;
    const user = (await axios.get(config.apiHost + "/user/")).data.user;
    action(() => {
      state.user = user;
    })();
    return user;
  },

  login: async (username, password) => {
    const res = await axios.post(config.apiHost + "/login", {
      username: username,
      password: password,
    });
    action(() => {
      state.user = res.data.user;
    })();
    return res.data.user;
  },

  refreshResumeWatchingList: async () => {
    const resp = await axios.get(config.apiHost + "/user/listResumeWatching");
    const resumeWatching = model.state.resumeWatching;
    if (!(resp.data instanceof Array)) return;
    for (const record of resp.data) {
      resumeWatching[record.mediaid] = record;
    }
    debug(
      "refreshResumeWatchingList: got " + resumeWatching.length + " records."
    );
  },

  updateResumeWatching: async (mediaid, position, total_duration) => {
    const resp = await axios.post(
      config.apiHost + "/user/setPlaybackPosition",
      {
        position: position,
        total_duration: total_duration,
        mediaid: mediaid,
      }
    );
    return resp.data;
  },
};

window.addEventListener("focus", () => {
  exports.refreshResumeWatchingList();
});

export default exports;
