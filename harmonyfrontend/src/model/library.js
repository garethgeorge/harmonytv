import axios from "axios";
import { action, extendObservable } from "mobx";
import model from ".";
import config from "../config";

class Library {
  constructor(library) {
    this._library = library;

    extendObservable(this, {
      _media: null,
      get media() {
        return this._media;
      },
      get series() {
        const series = {};
        for (const mediaObj of this._media) {
          series[mediaObj.seriesname] = series[mediaObj.seriesname] || [];
          series[mediaObj.seriesname].push(mediaObj);
        }
        return series;
      }
    });
  }

  get name() {
    return this._library.libraryname;
  }

  get id() {
    return this._library.id;
  }

  refreshMediaList() {
    axios.get(config.apiHost + "/library/" + this.library.libraryid + "/getMedia")
      .then(res => {
        action((res) => {
          this.media = res.data;
        });
      });
  }
}

export default {
  refreshLibraries: () => {
    model.state.libraries = null;
    return axios.get(config.apiHost + "/library/getAll")
      .then(action((res) => {
        console.log("LibraryManager::refreshLibraries() - libraries list: ", JSON.stringify(res.data, false, 3));
        model.state.libraries = {};
        for (const library of res.data) {
          model.state.libraries[library.libraryid] = new Library(library);
        }
      }))
      .catch((err) => {
        console.log("ERROR FETCHING LIBRARIES");
      });
  },
}