import axios from 'axios';
import config from "../config";
import {EventEmitter} from "events";
import * as user from "./user";

// specify that axios should pass cookies in its requests
axios.defaults.withCredentials = true

class Library extends EventEmitter {
  constructor(library) {
    super();
    this.library = library;
    this.media = null;
  }

  async getMedia() {
    if (this.media)
      return this.media;

    const res = await axios.get(config.apiHost + "/library/" + this.library.libraryid + "/getMedia");
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
    const res = await axios.get(config.apiHost + "/library/getAll")
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

let libraryManager = null;
const getLibraryManager = async () => {
  if (libraryManager)
    return libraryManager;
  
  const tmp = new LibraryManager();
  await tmp.refreshLibraries();
  libraryManager = tmp;
  return libraryManager;
}

const getMediaInfo = async (mediaid) => {
  const res = await axios.get(config.apiHost + "/media/" + mediaid + "/info.json");
  if (res.status !== 200)
    throw new Error("fatal error: media " + mediaid + " not found");
  return res.data;
}

const createLobbyWithMedia = async (mediaid) => {
  const res = await axios.get(config.apiHost + "/lobby/create?mediaid=" + mediaid);
  console.log("created lobby playing media: " + mediaid + " lobbyid: " + res.data.lobbyId);
  return res.data.lobbyId;
}


export {
  getLibraryManager,
  getMediaInfo,
  createLobbyWithMedia,
  user
}