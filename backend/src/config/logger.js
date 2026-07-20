import pino from 'pino';
import env from './env.js';

const isDevelopment = env.NODE_ENV === 'development';

/**
 * Configure Pino logger target.
 * Uses pino-pretty for clean local terminal logs during development,
 * and outputs standard structured JSON logs in production environments.
 */
const transport = isDevelopment
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    })
  : undefined;

/**
 * Centralized production-grade logger instance.
 * Houses logging level filters and custom formatting options.
 * 
 * @type {import('pino').Logger}
 */
export const logger = pino(
  {
    level: env.LOG_LEVEL || 'info',
    base: isDevelopment ? undefined : { env: env.NODE_ENV, service: 'mc-ledger-backend' },
    redact: {
      paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
      censor: '[REDACTED]',
    },
  },
  transport
);

export default logger;
