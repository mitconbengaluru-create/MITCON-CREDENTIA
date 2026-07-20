/**
 * Centralized registry of application error codes, standard messages, and HTTP status mappings.
 */
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  BUSINESS_RULE_ERROR: 'BUSINESS_RULE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  CONNECTION_FAILURE: 'CONNECTION_FAILURE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
});

export const HTTP_STATUS = Object.freeze({
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
});

export const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.VALIDATION_ERROR]: 'The request payload contains invalid parameters.',
  [ERROR_CODES.AUTHENTICATION_ERROR]: 'Authentication failed or credentials invalid.',
  [ERROR_CODES.AUTHORIZATION_ERROR]: 'Access denied: You lack sufficient permissions for this action.',
  [ERROR_CODES.DATABASE_ERROR]: 'A database transaction error occurred.',
  [ERROR_CODES.STORAGE_ERROR]: 'Cloud file storage provider failed to complete request.',
  [ERROR_CODES.SYSTEM_ERROR]: 'An internal system exception occurred.',
});

export default {
  ERROR_CODES,
  HTTP_STATUS,
  ERROR_MESSAGES,
};
