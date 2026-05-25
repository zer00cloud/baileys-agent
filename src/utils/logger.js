const pino = require('pino');
const { config } = require('../config');

const logger = pino({
  level: config.app.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      singleLine: false,
    },
  },
});

module.exports = logger;
