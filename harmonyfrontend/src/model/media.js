import axios from "axios";
import config from "../config";
export default {
  getInfo: async mediaid => {
    const res = await axios.get(
      config.apiHost + "/media/" + mediaid + "/info.json"
    );
    if (res.status !== 200)
      throw new Error("fatal error: media " + mediaid + " not found");
    return res.data;
  }
};
