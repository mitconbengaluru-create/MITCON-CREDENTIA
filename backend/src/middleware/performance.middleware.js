import { getMemoryMetrics } from '../utils/performance.util.js';
import logUtil from '../utils/logger.util.js';

// Warning thresholds
const SLOW_REQUEST_MS = 2000; // 2 seconds
const MEMORY_THRESHOLD_BYTES = 400 * 1024 * 1024; // 400 MB

/**
 * Hook triggered when requests exceed SLOW_REQUEST_MS latency bounds.
 */
export function slowRequestDetected(url, method, durationMs) {
  logUtil.warn(`[Performance Alert] Slow Request: ${method} ${url} took ${durationMs}ms`, {
    url,
    method,
    durationMs,
  });
}

/**
 * Hook triggered when process memory consumption exceeds MEMORY_THRESHOLD_BYTES limits.
 */
export function highMemoryUsageDetected(heapUsedBytes, rssBytes) {
  logUtil.warn(`[Performance Alert] High Memory Usage: Heap Used = ${(heapUsedBytes / (1024 * 1024)).toFixed(2)}MB | RSS = ${(rssBytes / (1024 * 1024)).toFixed(2)}MB`, {
    heapUsedBytes,
    rssBytes,
  });
}

/**
 * Global Express performance telemetry interceptor.
 */
export function performanceMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    if (durationMs > SLOW_REQUEST_MS) {
      slowRequestDetected(req.originalUrl || req.url, req.method, durationMs);
    }

    // Periodically monitor process memory limits on finishes
    const mem = getMemoryMetrics();
    if (mem.heapUsed > MEMORY_THRESHOLD_BYTES) {
      highMemoryUsageDetected(mem.heapUsed, mem.rss);
    }
  });

  next();
}

export default performanceMiddleware;
