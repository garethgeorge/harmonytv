import axios from "axios";
import state from "./state";
import user from "./user";
import library from "./library";
axios.defaults.withCredentials = true

export default {
  user,
  state,
  library,
}