/**
 * Sanitizes and normalizes query pagination bounds.
 * Restricts values to hardcoded default (50) and maximum (250) bounds.
 * 
 * @param {Object} query - Express request query object
 * @returns {{take: number, skip: number}} Prisma compatible limits
 */
export function getPaginationBounds(query) {
  const defaultLimit = 50;
  const maxLimit = 250;

  const rawLimit = parseInt(query.limit, 10);
  const rawPage = parseInt(query.page, 10);

  const limit = isNaN(rawLimit) || rawLimit <= 0
    ? defaultLimit
    : Math.min(rawLimit, maxLimit);

  const page = isNaN(rawPage) || rawPage <= 0
    ? 1
    : rawPage;

  const skip = (page - 1) * limit;

  return {
    take: limit,
    skip,
  };
}

/**
 * Validates dynamic keys to prevent unsafe column inclusions.
 * 
 * @param {string[]} allowedFields - Whitelisted query sorting fields
 * @param {string} field - Input field name
 * @param {string} [fallback='createdAt'] - Default order key fallback
 * @returns {string} Safe validated column identifier
 */
export function sanitizeSortField(allowedFields, field, fallback = 'createdAt') {
  if (!field || typeof field !== 'string') return fallback;
  return allowedFields.includes(field) ? field : fallback;
}

export default {
  getPaginationBounds,
  sanitizeSortField,
};
