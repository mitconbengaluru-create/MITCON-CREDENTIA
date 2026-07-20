process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import { AppError } from '../../src/utils/AppError.js';
import * as errorUtil from '../../src/utils/error.util.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import env from '../../src/config/env.js';

test.describe('Error Infrastructure Unit Tests', () => {
  test('AppError sets standard custom properties correctly', () => {
    const err = new AppError('Sample warning', 404, 'NOT_FOUND', { targetId: '123' });
    assert.strictEqual(err.message, 'Sample warning');
    assert.strictEqual(err.statusCode, 404);
    assert.strictEqual(err.errorCode, 'NOT_FOUND');
    assert.deepStrictEqual(err.details, { targetId: '123' });
    assert.strictEqual(err.isOperational, true);
    assert.ok(err.timestamp);
  });

  test('normalizeError parses standard errors into AppError models', () => {
    const stdErr = new Error('Generic failure');
    const normalized = errorUtil.normalizeError(stdErr);
    assert.ok(normalized instanceof AppError);
    assert.strictEqual(normalized.statusCode, 500);
    assert.strictEqual(normalized.errorCode, 'SYSTEM_ERROR');
    assert.strictEqual(normalized.isOperational, false);
  });

  test('normalizeError parses Prisma Unique constraint (P2002) violations', () => {
    const prismaErr = new Error('Prisma constraint failed');
    prismaErr.code = 'P2002';
    prismaErr.meta = { target: ['ref_number'] };

    const normalized = errorUtil.normalizeError(prismaErr);
    assert.ok(normalized instanceof AppError);
    assert.strictEqual(normalized.statusCode, 409);
    assert.strictEqual(normalized.errorCode, 'DUPLICATE_RECORD');
    assert.ok(normalized.message.includes('Unique constraint violation'));
  });

  test('errorMiddleware structures standard JSON responses and masks details in production', () => {
    const err = new AppError('Database write error', 500, 'DATABASE_ERROR', { query: 'INSERT INTO users' }, false);
    
    let responseStatus = 0;
    let responseBody = {};

    const req = { id: 'req-101' };
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(obj) {
        responseBody = obj;
        return this;
      }
    };

    // Override process.env.NODE_ENV temporarily to test production masking behavior
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      errorMiddleware(err, req, res, () => {});
      assert.strictEqual(responseStatus, 500);
      assert.strictEqual(responseBody.success, false);
      assert.strictEqual(responseBody.error.code, 'INTERNAL_ERROR');
      assert.strictEqual(responseBody.error.message, 'An unexpected internal error occurred on the server.');
      assert.strictEqual(responseBody.error.details, undefined);
      assert.strictEqual(responseBody.error.stack, undefined);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
