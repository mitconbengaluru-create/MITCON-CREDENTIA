import { normalizeError } from '../utils/error.util.js';
import env from '../config/env.js';

/**
 * Global Express centralized error boundary formatter.
 * Standardizes all application-level errors into a production-grade response structure.
 * 
 * @function errorMiddleware
 * @param {Error} err - Exception object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next handler callback
 */
export function errorMiddleware(err, req, res, next) {
  const normalized = normalizeError(err);
  const isProduction = process.env.NODE_ENV === 'production';

  // Build standard API error response payload
  const errorResponse = {
    code: normalized.errorCode,
    message: normalized.message,
    timestamp: normalized.timestamp,
    requestId: req.id || req.headers?.['x-request-id'] || 'N/A',
  };

  // Attach validation/exception details if present and safe to expose
  if (normalized.details) {
    errorResponse.details = normalized.details;
  }

  // Mask sensitive properties for non-operational or unexpected runtime bugs in production
  if (isProduction && !normalized.isOperational) {
    errorResponse.code = 'INTERNAL_ERROR';
    errorResponse.message = 'An unexpected internal error occurred on the server.';
    delete errorResponse.details; // Ensure no internal DB details leak
  }

  // Include stack traces only during local development runs
  if (!isProduction) {
    errorResponse.stack = err.stack;
  }

  res.status(normalized.statusCode).json({
    success: false,
    error: errorResponse,
  });
}

export default errorMiddleware;
