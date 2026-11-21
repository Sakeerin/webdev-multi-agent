import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  SECURITY_HEADERS,
  createStaticServer,
  resolveSafePath,
} from '../scripts/serve.mjs';

function invokeServer(server, { method = 'GET', url = '/' } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    let statusCode = 200;

    const res = {
      writeHead(code, rawHeaders = {}) {
        statusCode = code;
        for (const [key, value] of Object.entries(rawHeaders)) {
          headers[key.toLowerCase()] = value;
        }
      },
      end(chunk) {
        let body = '';
        if (Buffer.isBuffer(chunk)) {
          body = chunk.toString('utf8');
        } else if (typeof chunk === 'string') {
          body = chunk;
        }
        resolve({ statusCode, headers, body });
      },
    };

    server.emit('request', { method, url }, res);
  });
}

describe('SECURITY_HEADERS', () => {
  it('defines strict CSP and defensive HTTP security headers', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("form-action 'self'"));
    assert.ok(csp.includes("connect-src 'none'"));

    assert.equal(SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff');
    assert.equal(SECURITY_HEADERS['X-Frame-Options'], 'DENY');
    assert.equal(SECURITY_HEADERS['Referrer-Policy'], 'no-referrer');
    assert.equal(
      SECURITY_HEADERS['Permissions-Policy'],
      'camera=(), microphone=(), geolocation=()'
    );
  });
});

describe('resolveSafePath & createStaticServer', () => {
  let tempRoot;
  let distDir;
  let server;

  before(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'sprint-pulse-serve-test-'));
    distDir = path.join(tempRoot, 'dist');
    mkdirSync(path.join(distDir, 'sub'), { recursive: true });

    writeFileSync(path.join(distDir, 'index.html'), '<!DOCTYPE html><h1>Sprint Pulse</h1>');
    writeFileSync(path.join(distDir, 'app.js'), 'export const ok = true;');
    writeFileSync(path.join(distDir, 'sub', 'nested.txt'), 'nested');
    writeFileSync(path.join(tempRoot, 'secret.txt'), 'TOP_SECRET');

    server = createStaticServer(distDir);
  });

  after(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('serves root index.html and valid static assets', () => {
    const rootRes = resolveSafePath(distDir, '/');
    assert.equal(rootRes.status, 200);
    assert.equal(path.basename(rootRes.filePath), 'index.html');

    const jsRes = resolveSafePath(distDir, '/app.js');
    assert.equal(jsRes.status, 200);
    assert.equal(path.basename(jsRes.filePath), 'app.js');
  });

  it('returns 404 for missing paths inside dist', () => {
    assert.deepEqual(resolveSafePath(distDir, '/missing.js'), {
      status: 404,
      filePath: null,
    });
  });

  it('blocks dot-dot and encoded path traversal attempts with 403', () => {
    const vectors = [
      '/../secret.txt',
      '/%2e%2e/secret.txt',
      '/%2e%2e%2fsecret.txt',
      '/sub/../../secret.txt',
      '/..\\secret.txt',
      '/%5c..%5csecret.txt',
    ];
    for (const vector of vectors) {
      const res = resolveSafePath(distDir, vector);
      assert.equal(res.status, 403, `Expected 403 for vector: ${vector}`);
      assert.equal(res.filePath, null);
    }
  });

  it('rejects null bytes and malformed URI encoding', () => {
    assert.deepEqual(resolveSafePath(distDir, '/index.html\0.png'), {
      status: 400,
      filePath: null,
    });
    assert.deepEqual(resolveSafePath(distDir, '/index.html%00.png'), {
      status: 403,
      filePath: null,
    });
    assert.deepEqual(resolveSafePath(distDir, '/%E0%A4%A'), {
      status: 400,
      filePath: null,
    });
  });

  it('blocks Windows drive-letter prefixes and directory paths with 403', () => {
    for (const vector of ['/C:/Windows/win.ini', '/d:secret.txt', '/sub']) {
      const res = resolveSafePath(distDir, vector);
      assert.equal(res.status, 403, `Expected 403 for vector: ${vector}`);
      assert.equal(res.filePath, null);
    }
  });

  it('blocks symlink escapes outside dist with 403', (t) => {
    const linkPath = path.join(distDir, 'escape-link.txt');
    try {
      symlinkSync(path.join('..', 'secret.txt'), linkPath);
    } catch (err) {
      if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
        t.skip('Symlink creation requires elevated privileges on this Windows environment.');
        return;
      }
      throw err;
    }

    const res = resolveSafePath(distDir, '/escape-link.txt');
    assert.deepEqual(res, { status: 403, filePath: null });
  });

  it('serves GET / with strict security headers and HTML content-type', async () => {
    const res = await invokeServer(server, { method: 'GET', url: '/' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.ok(res.headers['content-security-policy']?.includes("form-action 'self'"));
    assert.ok(res.headers['content-security-policy']?.includes("connect-src 'none'"));
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.body.includes('Sprint Pulse'));
  });

  it('handles HEAD / with empty body and positive content-length', async () => {
    const res = await invokeServer(server, { method: 'HEAD', url: '/' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '');
    assert.ok(Number(res.headers['content-length']) > 0);
  });

  it('rejects POST / with 405 Method Not Allowed', async () => {
    const res = await invokeServer(server, { method: 'POST', url: '/' });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'GET, HEAD');
  });

  it('blocks raw HTTP /%2e%2e/secret.txt traversal with 403 and missing files with 404', async () => {
    const traversal = await invokeServer(server, {
      method: 'GET',
      url: '/%2e%2e/secret.txt',
    });
    assert.equal(traversal.statusCode, 403);

    const missing = await invokeServer(server, {
      method: 'GET',
      url: '/does-not-exist.js',
    });
    assert.equal(missing.statusCode, 404);
  });
});
