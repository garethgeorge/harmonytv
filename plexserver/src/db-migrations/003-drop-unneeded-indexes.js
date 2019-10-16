module.exports = {
  generateSql: () => {
    return `
      DROP INDEX mediaObjectsObjectIdIndex;
      DROP INDEX mediaSeriesIndex;
    `;
  }
}