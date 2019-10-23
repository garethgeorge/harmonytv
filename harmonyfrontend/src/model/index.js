import axios from "axios";
import state from "./state";
import user from "./user";
import library from "./library";
import lobby from "./lobby";
import media from "./media";

axios.defaults.withCredentials = true

export default {
  user,
  state,
  library,
  lobby,
  media 
}