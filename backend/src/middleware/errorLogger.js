import { logger } from '../config/logger.js';

/**
 * Express error logging middleware.
 * Intercepts uncaught route exceptions, logs structured details (message, stack, custom codes),
 * and correlates them to the active Request ID for tracing.
 * Passes the error down the chain to the client formatter.
 * 
 * @function errorLogger
 * @param {Error} err - Caught exception
 * @param {import('express').Request} req - Express Request
 * @param {import('express').Response} res - Express Response
 * @param {import('express').NextFunction} next - Express Next callback
 * @returns {void}
 */
export function errorLogger(err, req, res, next) {
  const reqId = req.id || 'N/A';

  logger.error({
    msg: `Exception caught on ${req.method} ${req.url}`,
    requestId: reqId,
    err: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      stack: err.stack
    }
  });

  next(err);
}

export default errorLogger;
