process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import app from '../../src/app.js';
import * as sanitizer from '../../src/utils/sanitizer.util.js';
import { checkMagicBytes } from '../../src/middleware/upload.middleware.js';
import { validatePasswordStrength } from '../../src/utils/security.util.js';

let server;
const PORT = 5007;
const BASE_URL = `http://localhost:${PORT}`;

test.describe('Production Security Hardening Tests', () => {
  test.before(() => {
    server = app.listen(PORT);
  });

  test.after(() => {
    server.close();
  });

  test('Helmet HTTP security headers are correctly present', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200);
    
    // Check for Helmet headers
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'));
    assert.strictEqual(res.headers.get('referrer-policy'), 'same-origin');
  });

  test('CORS blocks requests from untrusted origins', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: {
        'Origin': 'http://malicious-hacker-site.com',
      },
    });
    // CORS middleware yields a network/policy error, or status 500 / blocked
    assert.ok(res.status === 500 || res.status === 400 || !res.ok);
  });

  test('XSS recursive input sanitizer escapes HTML entities and strips scripts', () => {
    const dirty = {
      username: '<script>alert("XSS")</script>John',
      profile: {
        bio: 'Hello <img src="x" onerror="stealCookies()"> World',
      },
    };
    
    const clean = sanitizer.sanitizeInput(dirty);
    assert.strictEqual(clean.username, 'John');
    assert.ok(!clean.profile.bio.includes('<img'));
    assert.ok(clean.profile.bio.includes('&lt;img'));
  });

  test('checkMagicBytes validates binary document formats accurately', () => {
    // PDF Magic number %PDF (25 50 44 46)
    const validPdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x31, 0x2E, 0x34]);
    const invalidPdfBuffer = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x00]);

    assert.strictEqual(checkMagicBytes(validPdfBuffer, 'application/pdf'), true);
    assert.strictEqual(checkMagicBytes(invalidPdfBuffer, 'application/pdf'), false);

    // PNG Magic number (89 50 4E 47)
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    assert.strictEqual(checkMagicBytes(validPngBuffer, 'image/png'), true);
  });

  test('validatePasswordStrength checks complex character requirements', () => {
    assert.strictEqual(validatePasswordStrength('Plain123'), false); // Missing special
    assert.strictEqual(validatePasswordStrength('plain!!!123'), false); // Missing upper
    assert.strictEqual(validatePasswordStrength('STRONG!!!123'), false); // Missing lower
    assert.strictEqual(validatePasswordStrength('Str0ng!!!'), true); // Satisfies all criteria
  });
});
