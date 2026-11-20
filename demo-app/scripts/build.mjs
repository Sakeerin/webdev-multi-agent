import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const REQUIRED_DIST_FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'taskModel.js',
  'storage.js',
];

if (!existsSync(SRC_DIR)) {
  console.error(`Build failed: source directory not found at ${SRC_DIR}`);
  process.exit(1);
}

rmSync(DIST_DIR, { recursive: true, force: true });
mkdirSync(DIST_DIR, { recursive: true });
cpSync(SRC_DIR, DIST_DIR, { recursive: true });

const missing = REQUIRED_DIST_FILES.filter((file) => !existsSync(path.join(DIST_DIR, file)));
if (missing.length > 0) {
  console.error(`Build failed: missing required output file(s) in dist/: ${missing.join(', ')}`);
  process.exit(1);
}

const summary = REQUIRED_DIST_FILES.map((file) => {
  const bytes = statSync(path.join(DIST_DIR, file)).size;
  return `${file} (${bytes} B)`;
}).join(', ');

console.log(`Build succeeded -> dist/: ${summary}`);
