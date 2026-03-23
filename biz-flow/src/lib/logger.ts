import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logFile = path.join(process.cwd(), 'logs', 'app.json');

// Ensure logs directory exists
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for JSON logs
const jsonFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...metadata,
  });
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    jsonFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({
      filename: logFile,
      options: { flags: 'w' }, // 'w' replaces the file on startup, but we want it per chat?
    }),
  ],
});

// Helper to clear the file manually if needed (e.g. start of a request)
export const clearLogs = () => {
  try {
    fs.writeFileSync(logFile, '');
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
};

export default logger;
