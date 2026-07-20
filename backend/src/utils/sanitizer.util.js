/**
 * HTML entities escape mapping dictionary.
 */
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escapes characters that are unsafe for HTML output to prevent XSS payloads.
 * 
 * @param {string} str - Unescaped raw string
 * @returns {string} Sanitized clean string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'\/]/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Strips script blocks and recursively escapes nested inputs.
 * 
 * @param {any} val - Raw input value
 * @returns {any} Sanitized clean input
 */
export function sanitizeInput(val) {
  if (val === null || val === undefined) {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeInput(item));
  }

  if (typeof val === 'object') {
    const sanitized = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        sanitized[key] = sanitizeInput(val[key]);
      }
    }
    return sanitized;
  }

  if (typeof val === 'string') {
    // 1. Remove dangerous script patterns
    let cleaned = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // 2. Escape basic HTML entities
    cleaned = escapeHtml(cleaned);
    return cleaned.trim();
  }

  return val;
}

export default {
  escapeHtml,
  sanitizeInput,
};
