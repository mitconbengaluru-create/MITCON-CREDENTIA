/**
 * Production-grade custom exception model for centralized BCD-FSS error boundary capturing.
 * Supports clean status codes, internal error code identifiers, operational flags, and metadata details.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Descriptive error message
   * @param {number} statusCode - Express HTTP status response code (e.g. 400, 404, 500)
   * @param {string} errorCode - Internal mapping error code constant (e.g. 'VALIDATION_FAILED')
   * @param {Object|Array} [details=null] - Validation messages or payload context details
   * @param {boolean} [isOperational=true] - Marks if error is operational or programming failure
   */
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
