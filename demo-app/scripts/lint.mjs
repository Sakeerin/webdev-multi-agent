import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

const EXCLUDED_DIRS = new Set(['dist', 'node_modules', '.git']);

const BANNED_JS_PATTERNS = [
  { name: 'innerHTML', regex: /\.innerHTML\b/g },
  { name: 'outerHTML', regex: /\.outerHTML\b/g },
  { name: 'insertAdjacentHTML', regex: /\.insertAdjacentHTML\b/g },
  { name: 'document.write', regex: /\bdocument\.write\s*\(/g },
  { name: 'eval(', regex: /\beval\s*\(/g },
  { name: 'new Function', regex: /\bnew\s+Function\s*\(/g },
];

function collectFiles(dir, extensions, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(fullPath, extensions, results);
    } else if (extensions.has(path.extname(entry).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll('\\', '/');
}

const errors = [];

// 1. Syntax-check all .js and .mjs files via `node --check`
const jsFiles = collectFiles(ROOT_DIR, new Set(['.js', '.mjs']));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    errors.push(`Syntax error in ${rel(file)}:\n${(result.stderr || result.stdout).trim()}`);
  }
}

// 2. Scan src/ JS files for banned XSS / dynamic execution sinks
const srcJsFiles = collectFiles(SRC_DIR, new Set(['.js', '.mjs']));
for (const file of srcJsFiles) {
  const content = readFileSync(file, 'utf8');
  for (const { name, regex } of BANNED_JS_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(content)) {
      errors.push(`Security lint violation in ${rel(file)}: banned construct "${name}" found`);
    }
  }
}

// 3. Basic HTML checks for src/*.html
const htmlFiles = collectFiles(SRC_DIR, new Set(['.html']));
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const fileRel = rel(file);
  if (!/^<!DOCTYPE html>/i.test(content.trimStart())) {
    errors.push(`HTML lint error in ${fileRel}: missing <!DOCTYPE html> declaration`);
  }
  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(content)) {
    errors.push(`HTML lint error in ${fileRel}: <html> must specify a lang attribute`);
  }
  if (!/<meta\b[^>]*name=["']viewport["']/i.test(content)) {
    errors.push(`HTML lint error in ${fileRel}: missing responsive viewport meta tag`);
  }
  if (!/<header\b/i.test(content) || !/<main\b/i.test(content)) {
    errors.push(`HTML lint error in ${fileRel}: missing semantic <header> or <main> landmark`);
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(content)) {
    errors.push(`Security lint error in ${fileRel}: inline event handler attribute detected`);
  }
  if (/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(content)) {
    errors.push(`Security lint error in ${fileRel}: inline <script> block violates strict CSP`);
  }
  if (/javascript:/i.test(content)) {
    errors.push(`Security lint error in ${fileRel}: javascript: URI detected`);
  }
}

// 4. Basic CSS checks for src/*.css
const cssFiles = collectFiles(SRC_DIR, new Set(['.css']));
for (const file of cssFiles) {
  const content = readFileSync(file, 'utf8');
  const fileRel = rel(file);
  // Strip CSS comments before checking braces and directives
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  let balance = 0;
  for (const ch of stripped) {
    if (ch === '{') balance += 1;
    else if (ch === '}') balance -= 1;
    if (balance < 0) break;
  }
  if (balance !== 0) {
    errors.push(`CSS lint error in ${fileRel}: unbalanced curly braces`);
  }
  if (/@import\s+url\(/i.test(stripped)) {
    errors.push(`CSS lint error in ${fileRel}: external @import url() is prohibited`);
  }
  if (!/:root\s*\{/.test(stripped)) {
    errors.push(`CSS lint error in ${fileRel}: expected :root design tokens`);
  }
  if (!/prefers-reduced-motion/.test(stripped)) {
    errors.push(`CSS lint error in ${fileRel}: missing prefers-reduced-motion accessibility rule`);
  }
}

if (errors.length > 0) {
  console.error('Lint failed with errors:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `Lint passed: ${jsFiles.length} JS/MJS, ${htmlFiles.length} HTML, ${cssFiles.length} CSS file(s) checked.`
);
