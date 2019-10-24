const sanatizeName = (name) => {
  return name.split(" ").filter((segment) => {
    if (segment.match(/.*(p|\[.*\])\.(mp4|mkv|flv|mov|webm|mkv\.original|mp4\.original|flv\.original)$/))
      return false;
    return true;
  }).join(" ");
}

const extractResolution = (path) => {
  // try a few things 
  let match = null;
  match = name.match(/\-(\d+)p/);
  if (match)
    return parseInt(match[1]);
  match = name.match(/\[(\d+)x(\d+)\]/);
  if (match)
    return parseInt(match[1] * match[2]);
  
  return 0;
}

module.exports = {

  infoFromEpisodePath: (originPath) => {
    const info = {
      originPath: originPath,
      qualityScore: extractQuality(originPath),
    };

    const pathSegments = originPath.split("/").reverse();

    // find the series name
    for (const segment of pathSegments) {
      if (segment === pathSegments[0] || segment.toLowerCase().indexOf("season") !== -1)
        continue;
      info.seriesName = segment.trim();
      break;
    }

    const match = /.*S(\d+)E(\d+).*/.exec(pathSegments[0]);
    if (!match) {
      console.log("Error: could not extract Season or Episode number from path");
      process.exit(1);
    }
    info.seasonNumber = parseInt(match[1]);
    info.episodeNumber = parseInt(match[2]);

    const extensions = [".mp4", ".mkv"]

    info.niceName = sanatizeName(pathSegments[0]);
    if (!info.niceName || !info.seasonNumber || !info.episodeNumber || !info.seriesName) {
      throw new Error("could not extract all episode information from path, info retrieved: " + JSON.stringify(info, false, 2));
    }
    
    return info;
  },

  infoFromMoviePath: (originPath) => {
    const info = {
      originPath: originPath,
      qualityScore: extractQuality(originPath),
    };

    // the parent folder name is the name of the movie :P 
    info.niceName = pathSegments[1];

    return info;
  }

  // TODO: info from movie path
}