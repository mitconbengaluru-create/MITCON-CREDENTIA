import compression from 'compression';

/**
 * Global response Gzip compression middleware.
 * Compresses any payload exceeding 1024 bytes (1KB).
 */
export const compressionMiddleware = compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false; // Bypass if explicitly requested
    }
    // Default compression filter check
    return compression.filter(req, res);
  },
});

export default compressionMiddleware;
