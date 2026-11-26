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
  symlinkSync,
  unlinkSync,
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

    for (const rootFile of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'package.json']) {
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

  it('dryRun: true previews removal and leaves demo-app/, PLAN.md, and package.json untouched on disk', () => {
    const dir = createTempTemplateRepo();
    const originalPlan = readFileSync(path.join(dir, 'PLAN.md'), 'utf8');
    const originalPkg = readFileSync(path.join(dir, 'package.json'), 'utf8');

    const res = initTemplate(dir, { dryRun: true });
    assert.equal(res.dryRun, true);
    assert.equal(res.removedDemoApp, true);
    assert.deepEqual(res.cleanedPackageScripts, ['demo:lint', 'demo:test', 'demo:build']);
    assert.equal(existsSync(path.join(dir, 'demo-app', 'src', 'app.js')), true);
    assert.equal(readFileSync(path.join(dir, 'PLAN.md'), 'utf8'), originalPlan);
    assert.equal(readFileSync(path.join(dir, 'package.json'), 'utf8'), originalPkg);
  });

  it('removes demo-app/, strips demo:* scripts from package.json, writes BLANK_PLAN_TEMPLATE, passes validateWorkspace, and is idempotent', () => {
    const dir = createTempTemplateRepo();

    // First run removes demo-app/, strips demo:* scripts, and resets PLAN.md
    const firstRes = initTemplate(dir, { dryRun: false });
    assert.equal(firstRes.dryRun, false);
    assert.equal(firstRes.removedDemoApp, true);
    assert.deepEqual(firstRes.cleanedPackageScripts, ['demo:lint', 'demo:test', 'demo:build']);
    assert.equal(firstRes.validation.ok, true);
    assert.equal(existsSync(path.join(dir, 'demo-app')), false);
    assert.equal(readFileSync(path.join(dir, 'PLAN.md'), 'utf8'), BLANK_PLAN_TEMPLATE);

    const updatedPkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.equal('demo:lint' in updatedPkg.scripts, false);
    assert.equal('demo:test' in updatedPkg.scripts, false);
    assert.equal('demo:build' in updatedPkg.scripts, false);
    for (const preserved of ['validate', 'test', 'sync', 'template:init', 'template:init:dry-run']) {
      assert.equal(typeof updatedPkg.scripts[preserved], 'string', `Missing ${preserved} script`);
    }
    assert.equal(validateWorkspace(dir).ok, true);

    // Second run is idempotent when demo-app/ and demo:* scripts are already absent
    const secondRes = initTemplate(dir, { dryRun: false });
    assert.equal(secondRes.removedDemoApp, false);
    assert.deepEqual(secondRes.cleanedPackageScripts, []);
    assert.equal(secondRes.validation.ok, true);
    assert.equal(readFileSync(path.join(dir, 'PLAN.md'), 'utf8'), BLANK_PLAN_TEMPLATE);
  });

  it('rejects dangling or live symlinks at demo-app, PLAN.md, and package.json', () => {
    const tempTargetDir = mkdtempSync(path.join(os.tmpdir(), 'init-template-junction-target-'));
    const missingTargetFile = path.join(os.tmpdir(), `init-template-missing-file-${process.pid}-${Date.now()}.md`);

    // 1. Dangling directory symlink / junction at demo-app (create target -> link -> delete target)
    const demoLinkDir = createTempTemplateRepo();
    rmSync(path.join(demoLinkDir, 'demo-app'), { recursive: true, force: true });
    let createdDirLink = false;
    try {
      symlinkSync(
        tempTargetDir,
        path.join(demoLinkDir, 'demo-app'),
        process.platform === 'win32' ? 'junction' : 'dir'
      );
      createdDirLink = true;
    } catch (err) {
      if (err?.code !== 'EPERM' && err?.code !== 'EACCES') {
        throw err;
      }
    }
    rmSync(tempTargetDir, { recursive: true, force: true });
    if (createdDirLink) {
      assert.equal(existsSync(path.join(demoLinkDir, 'demo-app')), false);
      assert.throws(() => initTemplate(demoLinkDir), /symbolic link.*demo-app/i);
    }

    // 2. Dangling file symlink at PLAN.md and package.json (skip gracefully if OS denies file symlinks)
    for (const targetName of ['PLAN.md', 'package.json']) {
      const fileLinkDir = createTempTemplateRepo();
      unlinkSync(path.join(fileLinkDir, targetName));
      let createdFileLink = false;
      try {
        symlinkSync(missingTargetFile, path.join(fileLinkDir, targetName), 'file');
        createdFileLink = true;
      } catch (err) {
        if (err?.code !== 'EPERM' && err?.code !== 'EACCES') {
          throw err;
        }
      }
      if (createdFileLink) {
        assert.throws(() => initTemplate(fileLinkDir), /symbolic link/i);
      }
    }
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
