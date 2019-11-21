import { observable } from "mobx";

export default observable({
  user: null,
  libraries: null,
  resumeWatching: {}, // array of shows that the current user has watched or partially watched
  breadcrumbs: []
});
