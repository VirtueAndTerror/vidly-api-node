const config = require('config');
const winston = require('winston');
require('winston-mongodb');
require('express-async-errors');

module.exports = function () {
  winston.exceptions.handle(
    new winston.transports.Console({ colorize: true, prettyPrint: true }),
    new winston.transports.File({
      filename: 'uncaughtExceptions.log',
      prettyPrint: true,
    })
  );
  process.on('unhandledRejection', ex => {
    throw ex;
  });
  winston.add(new winston.transports.File({ filename: 'logfile.log' }));
  winston.add(
    new winston.transports.MongoDB({
      db: process.env.DB || config.get('db'),
      level: 'info',
      options: { useUnifiedTopology: true },
    })
  );
};
