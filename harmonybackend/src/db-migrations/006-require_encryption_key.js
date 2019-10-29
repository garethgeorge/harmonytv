module.exports = {
  generateSql: () => {
    return `
      DELETE FROM media WHERE mediaid IN (
        SELECT media.mediaid
        FROM media 
        JOIN media_objects ON media.mediaid = media_objects.mediaid
        WHERE encryptionkey IS NULL
      );
      ALTER TABLE media_objects ALTER COLUMN encryptionkey SET NOT NULL;
    `
  }
}