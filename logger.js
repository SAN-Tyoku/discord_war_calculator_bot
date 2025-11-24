/**
 * @fileoverview winstonを使用したロガー設定。
 * NODE_ENVに応じて開発環境ではコンソールに、本番環境ではファイルに出力します。
 */
// logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const { combine, timestamp, printf, colorize, align } = winston.format;

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// ログのフォーマットを定義
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
  // ログレベルを設定 (debug以上のレベルのログを記録)
  level: 'debug',
  // ログのフォーマットを結合
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  // ログの出力先を定義 (transports)
  transports: [
    // debugレベル以上のログを 'debug.log' ファイルに出力
    new winston.transports.File({ 
      filename: path.join(logDir, 'debug.log'),
      level: 'debug',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // errorレベル以上のログを 'error.log' ファイルに出力
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// 本番環境およびテスト環境以外では、コンソールにもログを出力する設定を追加
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
