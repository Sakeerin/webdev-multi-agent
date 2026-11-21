import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

import {
  SUPPORTED_TARGETS,
  mapClaudeTools,
  renderCodexToml,
  syncTools,
} from './sync-tools.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

describe('mapClaudeTools', () => {
  it('maps Antigravity tool names to Claude Code tool names and enforces least privilege', () => {
    assert.deepEqual(
      mapClaudeTools(['read_file', 'write_file', 'edit_file', 'run_command']),
      ['Read', 'Write', 'Edit', 'Bash']
    );
    assert.deepEqual(
      mapClaudeTools(['read_file', 'run_command', 'read_file']),
      ['Read', 'Bash']
    );
    const auditorMapped = mapClaudeTools(['read_file', 'run_command']);
    assert.equal(auditorMapped.includes('Write'), false);
    assert.equal(auditorMapped.includes('Edit'), false);
  });
});

describe('renderCodexToml', () => {
  it('renders valid TOML fields and escapes backslashes and triple quotes', () => {
    const toml = renderCodexToml({
      name: 'web-dev',
      description: 'Builds "375px" mobile-first UI in C:\\projects.',
      skills: ['frontend-ui-engineering', 'impeccable'],
      body: '# Web Dev\nUse C:\\src\\app and """quoted""" safely.',
    });

    assert.match(toml, /^name = "web-dev"/m);
    assert.match(toml, /^description = "Builds \\"375px\\" mobile-first UI in C:\\\\projects\."/m);
    assert.match(toml, /^skills = \["frontend-ui-engineering", "impeccable"\]/m);
    assert.ok(toml.includes('instructions = """\n'));
    assert.ok(toml.includes('C:\\\\src\\\\app'));
    assert.equal(toml.includes('"""quoted"""'), false);
    assert.ok(toml.includes('\\"\\"\\"quoted\\"\\"\\"'));
  });
});

describe('syncTools', () => {
  const tempDirs = [];

  function createTempWorkspace({ withNestedReference = true } = {}) {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'sync-tools-test-'));
    tempDirs.push(dir);
    cpSync(path.join(REPO_ROOT, '.agents'), path.join(dir, '.agents'), { recursive: true });
    if (withNestedReference) {
      const refDir = path.join(dir, '.agents', 'skills', 'security-and-hardening', 'references');
      mkdirSync(refDir, { recursive: true });
      writeFileSync(path.join(refDir, 'nested-check.md'), '# Nested Reference\n', 'utf8');
    }
    return dir;
  }

  after(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exposes the 4 supported cross-tool targets', () => {
    assert.deepEqual(SUPPORTED_TARGETS, ['claude', 'cursor', 'gemini', 'codex']);
  });

  it('syncs agents (with mapped tools) and skills recursively for --target=claude', () => {
    const dir = createTempWorkspace();
    const result = syncTools(dir, { target: 'claude' });

    assert.deepEqual(result.targets, ['claude']);
    assert.equal(result.dryRun, false);

    for (const agent of ['web-dev', 'tester', 'security-auditor', 'devops']) {
      const agentPath = path.join(dir, '.claude', 'agents', `${agent}.md`);
      assert.equal(existsSync(agentPath), true, `Missing ${agentPath}`);
      const content = readFileSync(agentPath, 'utf8');
      assert.ok(content.includes(`<!-- Generated from .agents/agents/${agent}.md by scripts/sync-tools.mjs -->`));
    }

    const auditorContent = readFileSync(
      path.join(dir, '.claude', 'agents', 'security-auditor.md'),
      'utf8'
    );
    assert.match(auditorContent, /^tools: Read, Bash$/m);
    assert.equal(auditorContent.includes('Write'), false);
    assert.equal(auditorContent.includes('Edit'), false);

    assert.equal(
      existsSync(path.join(dir, '.claude', 'skills', 'frontend-ui-engineering', 'SKILL.md')),
      true
    );
    assert.equal(
      existsSync(
        path.join(dir, '.claude', 'skills', 'security-and-hardening', 'references', 'nested-check.md')
      ),
      true
    );
  });

  it('syncs agents and skills for --target=cursor and --target=gemini', () => {
    const cursorDir = createTempWorkspace();
    const cursorRes = syncTools(cursorDir, { target: 'cursor' });
    assert.deepEqual(cursorRes.targets, ['cursor']);
    assert.equal(existsSync(path.join(cursorDir, '.cursor', 'agents', 'web-dev.md')), true);
    assert.equal(existsSync(path.join(cursorDir, '.cursor', 'skills', 'tdd', 'SKILL.md')), true);
    assert.equal(
      existsSync(
        path.join(cursorDir, '.cursor', 'skills', 'security-and-hardening', 'references', 'nested-check.md')
      ),
      true
    );

    const geminiDir = createTempWorkspace();
    const geminiRes = syncTools(geminiDir, { target: 'gemini' });
    assert.deepEqual(geminiRes.targets, ['gemini']);
    assert.equal(existsSync(path.join(geminiDir, '.gemini', 'agents', 'devops.md')), true);
    assert.equal(existsSync(path.join(geminiDir, '.gemini', 'skills', 'impeccable', 'SKILL.md')), true);
  });

  it('syncs .codex/agents/*.toml for --target=codex without duplicating skills', () => {
    const dir = createTempWorkspace();
    const res = syncTools(dir, { target: 'codex' });
    assert.deepEqual(res.targets, ['codex']);

    for (const agent of ['web-dev', 'tester', 'security-auditor', 'devops']) {
      const tomlPath = path.join(dir, '.codex', 'agents', `${agent}.toml`);
      assert.equal(existsSync(tomlPath), true);
      const raw = readFileSync(tomlPath, 'utf8');
      assert.ok(raw.includes(`name = "${agent}"`));
      assert.ok(raw.includes('instructions = """'));
    }

    assert.equal(existsSync(path.join(dir, '.codex', 'skills')), false);
    assert.equal(res.files.length, 4);
  });

  it('supports --target=all with dryRun: true without writing any files', () => {
    const dir = createTempWorkspace();
    const res = syncTools(dir, { target: 'all', dryRun: true });

    assert.deepEqual(res.targets, ['claude', 'cursor', 'gemini', 'codex']);
    assert.equal(res.dryRun, true);
    assert.ok(res.files.length > 0);

    for (const folder of ['.claude', '.cursor', '.gemini', '.codex']) {
      assert.equal(existsSync(path.join(dir, folder)), false, `${folder} should not exist on dryRun`);
    }
  });

  it('throws a descriptive error on unsupported targets', () => {
    const dir = createTempWorkspace();
    assert.throws(
      () => syncTools(dir, { target: 'unknown' }),
      /Unsupported target "unknown".*claude.*cursor.*gemini.*codex/i
    );
  });
});
