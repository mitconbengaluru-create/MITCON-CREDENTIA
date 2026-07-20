import express from 'express';
import { requestIdMiddleware } from './shared/request-id.js';
import {
  corsMiddleware,
  helmetMiddleware,
  requestLogger,
  cookieParserMiddleware,
  jsonParser,
  urlEncodedParser,
  compressionMiddleware,
  apiLimiter,
  errorLogger,
  errorMiddleware,
  performanceMiddleware
} from './middleware/index.js';
import authRouter from './auth/auth.routes.js';
import securityRouter from './routes/security.routes.js';
import documentsRouter from './routes/documents.routes.js';
import checkoutRouter from './routes/checkout.routes.js';
import backupRouter from './routes/backup.routes.js';
import notificationRouter from './routes/notification.routes.js';

const app = express();

// Register performance monitoring as the absolute first step
app.use(performanceMiddleware);

// ==========================================
// 1. Global Pre-Routing Middleware Chain
// ==========================================

// CORS must be evaluated first to properly handle cross-origin preflight requests
app.use(corsMiddleware);

// Register Helmet early to secure headers on all downstream responses
app.use(helmetMiddleware);

// Inject correlation identifier for tracing
app.use(requestIdMiddleware);

// Structured HTTP request logging
app.use(requestLogger);

// Cookie parsing
app.use(cookieParserMiddleware);

// JSON and URL-encoded request body parsing with size limits
app.use(jsonParser);
app.use(urlEncodedParser);

// Gzip response compression
app.use(compressionMiddleware);

// Global API rate limiting
app.use(apiLimiter);



// ==========================================
// 2. Routes Routing Mounts
// ==========================================

// Mount Authentication router
app.use('/api/auth', authRouter);

// Mount Document router
app.use('/api/documents', documentsRouter);

// Mount Checkout and Return router
app.use('/api', checkoutRouter);





// Mount Security policy and users router
app.use('/api', securityRouter);

// Mount Backup router
app.use('/api', backupRouter);

// Mount Notifications router
app.use('/api/notifications', notificationRouter);

// Base health probe check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 3. Post-Routing Fallback & Error Boundaries
// ==========================================

// 404 Not Found Middleware Handler
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
});

// Intercept and structure system error logs
app.use(errorLogger);

// Global Centralized Error Handler Middleware (Response Formatter)
app.use(errorMiddleware);

export default app;
