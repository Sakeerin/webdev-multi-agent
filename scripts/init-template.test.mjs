import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BLANK_PLAN_TEMPLATE, initTemplate } from './init-template.mjs';
import { validateWorkspace } from './validate-agents.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

describe('initTemplate', () => {
  const tempDirs = [];

  function createTempTemplateRepo() {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'init-template-test-'));
    tempDirs.push(dir);

    for (const rootFile of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
      cpSync(path.join(REPO_ROOT, rootFile), path.join(dir, rootFile));
    }
    cpSync(path.join(REPO_ROOT, '.agents'), path.join(dir, '.agents'), { recursive: true });

    // Create representative demo-app/ and active PLAN.md in the temp copy
    const demoSrcDir = path.join(dir, 'demo-app', 'src');
    mkdirSync(demoSrcDir, { recursive: true });
    writeFileSync(path.join(demoSrcDir, 'app.js'), 'export const demo = true;\n', 'utf8');
    writeFileSync(
      path.join(dir, 'demo-app', 'PLAN.example.md'),
      '# Completed Demo Plan\n',
      'utf8'
    );
    writeFileSync(
      path.join(dir, 'PLAN.md'),
      '# Active Phase Plan\n\nCustom in-progress notes referencing demo-app/PLAN.example.md.\n',
      'utf8'
    );

    return dir;
  }

  after(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exports a clean BLANK_PLAN_TEMPLATE with all 6 stages and no demo-app references', () => {
    assert.equal(typeof BLANK_PLAN_TEMPLATE, 'string');
    assert.ok(BLANK_PLAN_TEMPLATE.length > 100);
    for (const stage of ['Plan', 'Design', 'Build', 'Verify', 'Secure', 'Ship']) {
      assert.match(BLANK_PLAN_TEMPLATE, new RegExp(`\\b${stage}\\b`));
    }
    assert.equal(BLANK_PLAN_TEMPLATE.includes('demo-app'), false);
  });

  it('dryRun: true previews removal and leaves demo-app/ and PLAN.md untouched on disk', () => {
    const dir = createTempTemplateRepo();
    const originalPlan = readFileSync(path.join(dir, 'PLAN.md'), 'utf8');

    const res = initTemplate(dir, { dryRun: true });
    assert.equal(res.dryRun, true);
    assert.equal(res.removedDemoApp, true);
    assert.equal(existsSync(path.join(dir, 'demo-app', 'src', 'app.js')), true);
    assert.equal(readFileSync(path.join(dir, 'PLAN.md'), 'utf8'), originalPlan);
  });

  it('removes demo-app/, writes BLANK_PLAN_TEMPLATE, passes validateWorkspace, and is idempotent', () => {
    const dir = createTempTemplateRepo();

    // First run removes demo-app/ and resets PLAN.md
    const firstRes = initTemplate(dir, { dryRun: false });
    assert.equal(firstRes.dryRun, false);
    assert.equal(firstRes.removedDemoApp, true);
    assert.equal(firstRes.validation.ok, true);
    assert.equal(existsSync(path.join(dir, 'demo-app')), false);
    assert.equal(readFileSync(path.join(dir, 'PLAN.md'), 'utf8'), BLANK_PLAN_TEMPLATE);
    assert.equal(validateWorkspace(dir).ok, true);

    // Second run is idempotent when demo-app/ is already absent
    const secondRes = initTemplate(dir, { dryRun: false });
    assert.equal(secondRes.removedDemoApp, false);
    assert.equal(secondRes.validation.ok, true);
    assert.equal(readFileSync(path.join(dir, 'PLAN.md'), 'utf8'), BLANK_PLAN_TEMPLATE);
  });

  it('refuses to run against a directory that is not an AGENTS.md workspace', () => {
    const emptyDir = mkdtempSync(path.join(os.tmpdir(), 'init-template-empty-'));
    tempDirs.push(emptyDir);
    assert.throws(() => initTemplate(emptyDir), /AGENTS\.md/i);
  });

  it('supports --help and --dry-run CLI flags inside an isolated temp copy', () => {
    const dir = createTempTemplateRepo();
    const scriptsDir = path.join(dir, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    cpSync(path.join(__dirname, 'init-template.mjs'), path.join(scriptsDir, 'init-template.mjs'));
    cpSync(
      path.join(__dirname, 'validate-agents.mjs'),
      path.join(scriptsDir, 'validate-agents.mjs')
    );

    const helpRun = spawnSync(
      process.execPath,
      [path.join(scriptsDir, 'init-template.mjs'), '--help'],
      { encoding: 'utf8' }
    );
    assert.equal(helpRun.status, 0);
    assert.match(helpRun.stdout, /Usage: node scripts\/init-template\.mjs/);

    const dryCliRun = spawnSync(
      process.execPath,
      [path.join(scriptsDir, 'init-template.mjs'), '--dry-run'],
      { encoding: 'utf8' }
    );
    assert.equal(dryCliRun.status, 0);
    assert.equal(existsSync(path.join(dir, 'demo-app')), true);
  });
});
