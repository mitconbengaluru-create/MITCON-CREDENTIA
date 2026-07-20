/**
 * Express middleware routing schemas to Zod validation parsing.
 * Enforces unified parameters matching, throwing error contexts caught by the central middleware.
 * 
 * @param {import('zod').ZodSchema} schema - Zod validator object
 * @returns {import('express').RequestHandler} Route validation middleware
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    // Assign validated/sanitized schema outputs back to express objects
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;
    
    next();
  } catch (error) {
    next(error);
  }
};

export default validate;
