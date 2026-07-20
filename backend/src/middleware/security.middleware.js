import express from 'express';
import { corsMiddleware } from '../config/cors.js';
import { helmetMiddleware } from '../config/helmet.js';
import { apiLimiter } from './rateLimit.middleware.js';
import { sanitizeInput } from '../utils/sanitizer.util.js';
import cookieParser from 'cookie-parser';
import env from '../config/env.js';

const jsonSizeLimit = '10mb';
const urlEncodedSizeLimit = '10mb';

/**
 * XSS input sanitization middleware.
 * Recursively cleans body, query parameters, and URL param bindings.
 */
export function sanitizeRequestMiddleware(req, res, next) {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
}

export const jsonParser = express.json({ limit: jsonSizeLimit });
export const urlEncodedParser = express.urlencoded({ extended: true, limit: urlEncodedSizeLimit });
export const cookieParserMiddleware = cookieParser(env.JWT_SECRET);

/**
 * Registers the production security middleware stack.
 * 
 * @param {import('express').Express} app - Express App instance
 */
export function registerSecurityMiddleware(app) {
  app.use(corsMiddleware);
  app.use(helmetMiddleware);
  app.use(cookieParserMiddleware);
  app.use(jsonParser);
  app.use(urlEncodedParser);
  app.use(sanitizeRequestMiddleware);
  app.use(apiLimiter);
}

export default registerSecurityMiddleware;
