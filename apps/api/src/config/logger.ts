import winston from 'winston';
import { env } from './env.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'secret',
  'apikey',
  'api_key',
  'accesstoken',
  'refreshtoken',
  'creditcard',
  'cvv',
  'cardnumber',
  'apple_shared_secret',
  'stripe_secret_key',
]);

const redactObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);

  const redacted: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
      redacted[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      redacted[key] = redactObject(val);
    } else {
      redacted[key] = val;
    }
  }
  return redacted;
};

const redactFormat = winston.format((info) => {
  for (const [key, val] of Object.entries(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp' || key === 'correlationId') {
      continue;
    }
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
      info[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      info[key] = redactObject(val);
    }
  }
  return info;
});

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  redactFormat(),
  env.NODE_ENV === 'production' || env.NODE_ENV === 'staging'
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
          const cid = correlationId ? `[${correlationId}] ` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${cid}${message}${metaStr}`;
        }),
      ),
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      silent: env.NODE_ENV === 'test',
    }),
  ],
});
