import logUtil from './logger.util.js';

/**
 * Captures process heap, stack, and resident set size allocations.
 * 
 * @returns {{rss: number, heapTotal: number, heapUsed: number, external: number}} Memory state details
 */
export function getMemoryMetrics() {
  const memoryUsage = process.memoryUsage();
  return {
    rss: memoryUsage.rss,
    heapTotal: memoryUsage.heapTotal,
    heapUsed: memoryUsage.heapUsed,
    external: memoryUsage.external,
  };
}

/**
 * Event hook recording slow database queries.
 * 
 * @param {string} sqlQuery - Query string/model target
 * @param {number} durationMs - Duration in milliseconds
 */
export function slowQueryDetected(sqlQuery, durationMs) {
  logUtil.warn(`[Performance Alert] Slow Query detected: ${sqlQuery} took ${durationMs}ms`, {
    query: sqlQuery,
    durationMs,
  });
}

export default {
  getMemoryMetrics,
  slowQueryDetected,
};
