/**
 * @fileoverview winstonを使用したロガー設定。
 * NODE_ENVに応じて開発環境ではコンソールに、本番環境ではファイルに出力します。
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const { combine, timestamp, printf, colorize, align } = winston.format;

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
  level: 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'debug.log'),
      level: 'debug',
      maxsize: 5242880, 
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, 
      maxFiles: 5,
    }),
  ],
});

if (!['production', 'test'].includes(process.env.NODE_ENV)) {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      align(),
      logFormat
    ),
    level: 'debug',
  }));
}

module.exports = logger;