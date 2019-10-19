module.exports = {
  generateSql: () => {
    return `
      ALTER TABLE user_resume_watching ADD COLUMN last_played TIMESTAMP;
      ALTER TABLE user_resume_watching ALTER COLUMN last_played SET DEFAULT now();
    `
  }
}