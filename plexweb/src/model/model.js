import axios from 'axios';
import config from "../config";
import {EventEmitter} from "events";

class Library extends EventEmitter {
  constructor(library) {
    super();
    this.library = library;
    this.media = null;
  }

  async getMedia() {
    if (this.media)
      return this.media;

    const res = await axios.get(config.apiHost + "/api/library/" + this.library.libraryid + "/getMedia");
    this.media = res.data;
    
    const series = {};
    for (const mediaObj of res.data) {
      series[mediaObj.seriesname] = series[mediaObj.seriesname] || [];
      series[mediaObj.seriesname].push(mediaObj);
    }
    this.series = series;

    return res.data;
  }

  async getSeries() {
    await this.getMedia();
    return this.series;
  }
}

class LibraryManager extends EventEmitter {
  libraries = null;

  constructor() {
    super();
  }

  async refreshLibraries() {
    const res = await axios.get(config.apiHost + "/api/getLibraries")
    console.log("LibraryManager::refreshLibraries() - libraries list: ", JSON.stringify(res.data, false, 3));
    this.libraries = {};
    for (const library of res.data) {
      this.libraries[library.libraryid] = new Library(library);
    }
  }

  getLibraryById(id) {
    return this.libraries[id] || null;
  }
}

const libraryManager = new LibraryManager();

const getLibraryManager = async () => {
  const libraryManager = new LibraryManager();
  await libraryManager.refreshLibraries();
  return libraryManager;
}

const getMedia = async (mediaid) => {
  const res = await axios.get(config.apiHost + "/media/" + mediaid + "/info.json");
  if (res.status !== 200)
    throw new Error("fatal error: media " + mediaid + " not found");
  return res.data;
}

export {
  getLibraryManager,
  getMedia,
}