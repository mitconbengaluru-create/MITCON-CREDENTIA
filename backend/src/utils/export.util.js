import crypto from 'crypto';

/**
 * Prevents formula injection by prepending a single quote to cells starting with unsafe CSV tokens.
 * 
 * @param {*} value - Target cell value
 * @returns {*} Sanitized cell value
 */
export function sanitizeCellValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
      return `'${value}`;
    }
  }
  return value;
}

/**
 * Iterates over an object or array and masks sensitive properties/fields.
 * 
 * @param {*} data - Target object or dataset array
 * @returns {*} Masked data copy
 */
export function maskSensitiveFields(data) {
  if (!data) return data;

  const sensitiveKeys = ['password', 'token', 'otp', 'apikey', 'secret', 'jwt', 'smtp_password'];

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveFields(item));
  }

  if (typeof data === 'object') {
    const copy = {};
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        copy[key] = '[REDACTED]';
      } else if (typeof data[key] === 'object') {
        copy[key] = maskSensitiveFields(data[key]);
      } else {
        copy[key] = data[key];
      }
    }
    return copy;
  }

  return data;
}

/**
 * Calculates SHA256 checksum hash from a buffer.
 * 
 * @param {Buffer} buffer - Target binary buffer
 * @returns {string} Hex encoded SHA256 hash string
 */
export function calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Formats a Date object or string consistently for spreadsheets.
 * 
 * @param {Date|string} date - Date representation
 * @returns {string} Standard formatted date string
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Sanitizes and parses numeric cell values safely.
 * 
 * @param {*} num - Numeric value
 * @returns {number|string} Parsed float/int or original string
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '';
  const parsed = Number(num);
  return isNaN(parsed) ? num : parsed;
}
