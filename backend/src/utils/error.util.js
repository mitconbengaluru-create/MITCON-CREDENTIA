import { AppError } from './AppError.js';
import { ERROR_CODES, HTTP_STATUS } from '../constants/error.constants.js';

/**
 * Normalizes external/system exceptions into unified AppError models.
 * 
 * @param {Error} err - Standard or external library Error instance
 * @returns {AppError} Standardized application error model
 */
export function normalizeError(err) {
  if (err instanceof AppError) {
    return err;
  }

  // 1. Zod Validation Error Mapping
  if (err.name === 'ZodError') {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return new AppError('Validation failed.', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, details);
  }

  // 2. Prisma Database Error Mapping
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    switch (err.code) {
      case 'P2002': {
        const fields = err.meta?.target || [];
        return new AppError(
          `Unique constraint violation: A record with this value already exists on ${fields.join(', ')}.`,
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.DUPLICATE_RECORD,
          err.meta
        );
      }
      case 'P2025':
        return new AppError(
          err.meta?.cause || 'The requested record was not found or does not exist.',
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND,
          err.meta
        );
      case 'P2003':
        return new AppError(
          'Foreign key constraint violation: Related reference record not found.',
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.FOREIGN_KEY_VIOLATION,
          err.meta
        );
      case 'P2028':
      case 'P1001':
      case 'P1002':
      case 'P1003':
      case 'P1008':
      case 'P1017':
        return new AppError(
          'Database connection failure: Service is temporarily offline.',
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          ERROR_CODES.CONNECTION_FAILURE,
          null,
          false // Mark as non-operational system level error
        );
      default:
        return new AppError(
          `Database error occurred: ${err.message}`,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.DATABASE_ERROR,
          err.meta,
          false
        );
    }
  }

  // 3. Supabase / Storage Error Mapping
  if (err.storage_error_code) {
    return new AppError(
      err.message || 'Storage operation failed.',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.STORAGE_ERROR,
      err
    );
  }

  // Fallback default error mapping
  return new AppError(
    err.message || 'An unexpected internal error occurred.',
    err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
    err.code || ERROR_CODES.SYSTEM_ERROR,
    null,
    false
  );
}

export default {
  normalizeError,
};
