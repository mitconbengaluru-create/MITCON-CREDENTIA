/**
 * Reusable Express middleware wrapper that catches promise rejections and forwards them
 * directly to the next error boundary middleware, removing repeated try/catch blocks.
 * 
 * @param {Function} fn - Async Express router function
 * @returns {Function} Express route handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
