import axios from 'axios';
import config from "../config";

// can be used to login to an account 

// can be used to test if logged in, will return null if we are not 
const getCurrentUserInfo = async () => {
  
}

const loginWithCredentials = async (username, password) => {
  const res = await axios.post(config.apiHost + "/login", {"username": username, "password": password});
}

export {
  getCurrentUserInfo,
  loginWithCredentials
}