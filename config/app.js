const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  appPort: process.env.APP_PORT,
  dbUrl: process.env.DB_URL,
};
