import { logger } from '../config/logger.js';
import * as exportUtil from './export.util.js';

/**
 * Normalizes log payloads and applies automatic data masking.
 * 
 * @param {Object} metadata - Log context metadata
 * @returns {Object} Masked metadata
 */
export function maskLogMetadata(metadata) {
  return exportUtil.maskSensitiveFields(metadata);
}

/**
 * Standard log struct builder wrapping pino logger.
 */
export const logUtil = {
  info(message, context = {}) {
    const masked = maskLogMetadata(context);
    logger.info(masked, message);
  },

  warn(message, context = {}) {
    const masked = maskLogMetadata(context);
    logger.warn(masked, message);
  },

  error(message, err = null, context = {}) {
    const masked = maskLogMetadata({
      ...context,
      ...(err && {
        error: {
          message: err.message,
          code: err.code || err.errorCode || 'INTERNAL_ERROR',
          stack: err.stack,
        },
      }),
    });
    logger.error(masked, message);
  },

  debug(message, context = {}) {
    const masked = maskLogMetadata(context);
    logger.debug(masked, message);
  },

  http(message, context = {}) {
    const masked = maskLogMetadata(context);
    logger.info({ ...masked, level: 'http' }, message); // Pino default maps HTTP to info level
  },
};

export default logUtil;
