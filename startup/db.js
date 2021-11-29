const winston = require('winston');
const mongoose = require('mongoose');
const config = require('config');

module.exports = function () {
  const db = config.get('db');
  const options = { useUnifiedTopology: true };
  mongoose
    .connect(db, options)
    .then(() => winston.info(`Connected to ${db}...`))
    .catch(ex => console.log(ex));
};
