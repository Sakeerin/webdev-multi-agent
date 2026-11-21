import { createServer } from 'node:http';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DIST_DIR = path.join(ROOT_DIR, 'dist');

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; connect-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-cache',
});

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
});

function parsePort(rawPort) {
  if (rawPort === undefined || rawPort === '') return 4173;
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new RangeError(`Invalid PORT "${rawPort}": must be an integer between 0 and 65535`);
  }
  return parsed;
}

export function resolveSafePath(distDir, rawPathname) {
  if (typeof rawPathname !== 'string' || rawPathname.includes('\0')) {
    return { status: 400, filePath: null };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    return { status: 400, filePath: null };
  }

  if (decoded.includes('\0') || decoded.includes('\\')) {
    return { status: 403, filePath: null };
  }

  const normalizedRoute = decoded === '/' ? '/index.html' : decoded;
  const relativeTarget = normalizedRoute.replace(/^\/+/, '');
  if (/^[a-zA-Z]:/.test(relativeTarget)) {
    return { status: 403, filePath: null };
  }
  const resolvedDist = path.resolve(distDir);
  const candidate = path.resolve(resolvedDist, relativeTarget);

  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    return { status: 403, filePath: null };
  }

  if (!existsSync(candidate)) {
    return { status: 404, filePath: null };
  }

  let realDist;
  let realCandidate;
  try {
    realDist = realpathSync(resolvedDist);
    realCandidate = realpathSync(candidate);
  } catch {
    return { status: 404, filePath: null };
  }

  if (realCandidate !== realDist && !realCandidate.startsWith(realDist + path.sep)) {
    return { status: 403, filePath: null };
  }

  const stats = statSync(realCandidate);
  if (!stats.isFile()) {
    return { status: 403, filePath: null };
  }

  return { status: 200, filePath: realCandidate };
}

function sendText(res, statusCode, message, extraHeaders = {}) {
  const body = Buffer.from(message, 'utf8');
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    ...extraHeaders,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(body.length),
  });
  res.end(body);
}

export function createStaticServer(distDir = DEFAULT_DIST_DIR) {
  return createServer((req, res) => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
      return;
    }

    const rawTarget = req.url ?? '/';
    let pathname;
    try {
      const url = new URL(rawTarget, 'http://127.0.0.1');
      pathname = rawTarget.startsWith('/') ? rawTarget.split(/[?#]/, 1)[0] : url.pathname;
    } catch {
      sendText(res, 400, 'Bad Request');
      return;
    }

    const resolved = resolveSafePath(distDir, pathname);
    if (resolved.status !== 200 || !resolved.filePath) {
      const messages = {
        400: 'Bad Request',
        403: 'Forbidden',
        404: 'Not Found',
      };
      sendText(res, resolved.status, messages[resolved.status] ?? 'Error');
      return;
    }

    try {
      const ext = path.extname(resolved.filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const content = readFileSync(resolved.filePath);

      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(content.length),
      });

      if (method === 'HEAD') {
        res.end();
      } else {
        res.end(content);
      }
    } catch {
      sendText(res, 500, 'Internal Server Error');
    }
  });
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  if (!existsSync(DEFAULT_DIST_DIR)) {
    console.error('dist/ directory not found. Run "npm run build" before starting the server.');
    process.exit(1);
  }

  const host = '127.0.0.1';
  const port = parsePort(process.env.PORT);
  const server = createStaticServer(DEFAULT_DIST_DIR);

  server.listen(port, host, () => {
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    console.log(`Sprint Pulse server listening at http://${host}:${activePort}`);
  });
}
