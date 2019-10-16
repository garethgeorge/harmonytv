module.exports = {
  generateSql: () => {
    // TODO: mark TLibrary as NOT NULL
    return `
      ALTER TABLE media_objects ADD encryptionkey VARCHAR(255)
    `
  }
}