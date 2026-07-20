import crypto from 'crypto';

/**
 * Express middleware to manage and inject request correlation identifiers (Request IDs).
 * Inspects incoming headers for an existing ID, otherwise generates a secure random UUID.
 * Binds the identifier to the request context ('req.id') and sets it in the response header.
 * 
 * @function requestIdMiddleware
 * @param {import('express').Request} req - Express Request
 * @param {import('express').Response} res - Express Response
 * @param {import('express').NextFunction} next - Express Next callback
 * @returns {void}
 */
export function requestIdMiddleware(req, res, next) {
  const headerName = 'x-request-id';
  const correlationId = req.headers[headerName] || crypto.randomUUID();

  // Attach to Express request scope for reuse in child loggers or downstream tasks
  req.id = correlationId;

  // Mirror back to client for easy triage
  res.setHeader(headerName, correlationId);

  next();
}

export default requestIdMiddleware;
