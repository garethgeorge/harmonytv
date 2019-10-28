module.exports = {
  generateSql: () => {
    return `
      ALTER TABLE media ADD COLUMN date_added TIMESTAMP;
      ALTER TABLE media ALTER COLUMN date_added SET DEFAULT now();
      UPDATE media SET date_added = now();
      ALTER TABLE media ALTER COLUMN date_added SET NOT NULL;
    `
  }
}