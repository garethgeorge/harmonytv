module.exports = {
  generateSql: () => {
    // TODO: mark TLibrary as NOT NULL
    return `
      CREATE TYPE TLibrary AS ENUM('tv', 'movies', 'anime');

      CREATE TABLE libraries (
        libraryId CHAR(36) PRIMARY KEY NOT NULL,
        libraryName VARCHAR(36) NOT NULL,
        libraryType TLibrary NOT NULL
      );

      CREATE TABLE media (
        mediaId CHAR(36) PRIMARY KEY NOT NULL, 
        libraryId CHAR(36) NOT NULL, 
        name VARCHAR(512) NOT NULL,
        originPath VARCHAR(512) NOT NULL, 
        metadata JSON NOT NULL,
        seriesName VARCHAR(512),
        seasonNumber INTEGER,
        episodeNumber INTEGER,
        UNIQUE (seriesName, seasonNumber, episodeNumber),
        FOREIGN KEY (libraryId) REFERENCES libraries (libraryId) ON DELETE CASCADE
      );

      CREATE TABLE media_objects (
        mediaId CHAR(36) NOT NULL, 
        path VARCHAR(100) NOT NULL, 
        objectId VARCHAR(100) UNIQUE NOT NULL, 
        PRIMARY KEY (mediaId, path),
        FOREIGN KEY (mediaId) REFERENCES media (mediaId) ON DELETE CASCADE
      );

      CREATE TABLE users (
        userid VARCHAR(100) PRIMARY KEY NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        passwordSHA256 VARCHAR(64) NOT NULL
      );

      CREATE TABLE user_resume_watching (
        userid VARCHAR(100) NOT NULL,
        mediaid VARCHAR(100) NOT NULL,
        position BIGINT NOT NULL,
        total_duration BIGINT NOT NULL,
        PRIMARY KEY (userid, mediaid),
        FOREIGN KEY (userid) REFERENCES users (userid) ON DELETE CASCADE,
        FOREIGN KEY (mediaid) REFERENCES media (mediaid) ON DELETE CASCADE
      );

      CREATE INDEX mediaObjectsObjectIdIndex ON media_objects (objectId);

      CREATE INDEX mediaSeriesIndex ON media (seriesName, seasonNumber, episodeNumber) 
      WHERE seriesName IS NOT NULL AND seasonNumber IS NOT NULL AND episodeNumber IS NOT NULL;
    `;
  }
}