module.exports = {
  // for TV libraries
  infoFromEpisodePath = (originPath) => {
    const info = {};

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
    
    info.niceName = pathSegments[0].split(" ").filter((segment) => {
      if (segment.match(/.*\.(mp4|mkv|flv|mov|webm)$/))
        return false;
      if (segment.match(/.\[.*\]\.(mp4|mkv|flv|mov|webm)$/))
        return false;
      return true;
    }).join(" ");

    if (!info.niceName || !info.seasonNumber || !info.episodeNumber || !info.seriesName) {
      throw new Error("could not extract all episode information from path, info retrieved: " + JSON.stringify(info, false, 2));
    }
    return info;
  }

  // TODO: info from movie path
}