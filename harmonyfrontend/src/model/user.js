import axios from "axios";
import state from "./state";
import model from ".";
import {action} from "mobx";
import config from "../config";

export default {
  getCurrentUser: async () => {
    if (state.user !== null)
      return state.user;
    const user = (await axios.get(config.apiHost + "/user/")).data.user;
    action(() => {
      state.user = user;
    })();
    return user;
  },

  login: async (username, password) => {
    const res = await axios.post(config.apiHost + "/login", {"username": username, "password": password});
    action(() => {
      state.user = res.data.user;
    })();
    return res.data.user;
  },

  refreshResumeWatchingList: async (mediaid, position, total_duration) => {
    const resp = await axios.post(config.apiHost + "/user/setPlaybackPosition", {
      position: position,
      total_duration: total_duration,
      mediaid: mediaid
    });
    return resp.data;
  },

  // TODO: update this to be limited to the currently active library 
  refreshResumeWatchingList: async () => {
    const resp = await axios.get(config.apiHost + "/user/listResumeWatching");
    const resumeWatching = model.state.resumeWatching;
    for (const record of resp.data) {
      resumeWatching[record.mediaid] = record;
    }
  },

  updateResumeWatching: async (mediaid, position, total_duration) => {
    const resp = await axios.post(config.apiHost + "/user/setPlaybackPosition", {
      position: position,
      total_duration: total_duration,
      mediaid: mediaid
    });
    return resp.data;
  }
}