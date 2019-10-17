import axios from 'axios';
import config from "../config";

// can be used to login to an account 

// can be used to test if logged in, will return null if we are not 
const getCurrentUserInfo = async () => {
  const res = await axios.get(config.apiHost + "/user/");
  console.log("USER ACCOUNT: " + JSON.stringify(res.data));
  return res.data.user;
}

const loginWithCredentials = async (username, password) => {
  const res = await axios.post(config.apiHost + "/login", {"username": username, "password": password});
  console.log("LOGIN RESPONSE: " + JSON.stringify(res.data));
  return res.data.user;
}

export {
  getCurrentUserInfo,
  loginWithCredentials
}