import axios from 'axios';
import config from "../config";

// can be used to login to an account 

// can be used to test if logged in, will return null if we are not 
let userInfo = null;
const getCurrentUserInfo = async () => {
  if (userInfo)
    return userInfo;

  const res = await axios.get(config.apiHost + "/user/");
  console.log("USER ACCOUNT: " + JSON.stringify(res.data));
  userInfo = res.data.user;
  return res.data.user;
}

const loginWithCredentials = async (username, password) => {
  const res = await axios.post(config.apiHost + "/login", {"username": username, "password": password});
  console.log("LOGIN RESPONSE: " + JSON.stringify(res.data));
  return res.data.user;
}

const updateResumeWatching = async (mediaid, position, total_duration) => {
  const resp = await axios.post(config.apiHost + "/user/setPlaybackPosition", {
    position: position,
    total_duration: total_duration,
    mediaid: mediaid
  });
  return resp.data;
}

let resumeWatching = null;
const listResumeWatching = async () => {
  console.log("listResumeWatching...");
  if (resumeWatching)
    return resumeWatching;
  const resp = await axios.get(config.apiHost + "/user/listResumeWatching");
  resumeWatching = resp.data;
  return resp.data;
}

export {
  getCurrentUserInfo,
  loginWithCredentials,
  updateResumeWatching,
  listResumeWatching,
}