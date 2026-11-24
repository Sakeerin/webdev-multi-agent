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

import {
  SUPPORTED_TARGETS,
  mapClaudeTools,
  renderCodexToml,
  syncTools,
} from './sync-tools.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SYNC_SCRIPT_PATH = path.join(__dirname, 'sync-tools.mjs');

describe('mapClaudeTools', () => {
  it('maps Antigravity tool names to Claude Code tool names and enforces least privilege', () => {
    assert.deepEqual(
      mapClaudeTools(['read_file', 'write_file', 'edit_file', 'run_command']),
      ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash']
    );
    assert.deepEqual(
      mapClaudeTools(['read_file', 'run_command', 'read_file']),
      ['Read', 'Glob', 'Grep', 'Bash']
    );
    assert.deepEqual(
      mapClaudeTools(['read_file', 'search_web']),
      ['Read', 'Glob', 'Grep', 'WebSearch']
    );
    const auditorMapped = mapClaudeTools(['read_file', 'run_command']);
    assert.deepEqual(auditorMapped, ['Read', 'Glob', 'Grep', 'Bash']);
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
    assert.match(auditorContent, /^tools: Read, Glob, Grep, Bash$/m);
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

  it('clean: true removes zombie agent/skill files and prunes empty skill dirs while preserving non-managed files', () => {
    const dir = createTempWorkspace();
    syncTools(dir, { target: 'all' });

    // Plant zombie files inside managed subdirectories
    const zombieSkillPath = path.join(dir, '.claude', 'skills', 'old-skill', 'SKILL.md');
    const zombieClaudeAgentPath = path.join(dir, '.claude', 'agents', 'retired-agent.md');
    const zombieCodexPath = path.join(dir, '.codex', 'agents', 'old.toml');
    mkdirSync(path.dirname(zombieSkillPath), { recursive: true });
    writeFileSync(zombieSkillPath, '# Zombie Skill\n', 'utf8');
    writeFileSync(zombieClaudeAgentPath, '# Zombie Agent\n', 'utf8');
    writeFileSync(zombieCodexPath, 'name = "old"\n', 'utf8');

    // Plant user-owned config files OUTSIDE managed subdirectories
    const claudeSettingsPath = path.join(dir, '.claude', 'settings.json');
    const cursorCustomRulePath = path.join(dir, '.cursor', 'rules', 'keep.mdc');
    mkdirSync(path.dirname(cursorCustomRulePath), { recursive: true });
    writeFileSync(claudeSettingsPath, '{"theme":"dark"}\n', 'utf8');
    writeFileSync(cursorCustomRulePath, '# Custom Cursor Rule\n', 'utf8');

    // 1. clean: true + dryRun: true reports removed without deleting from disk
    const dryCleanRes = syncTools(dir, { target: 'all', clean: true, dryRun: true });
    assert.deepEqual(
      dryCleanRes.removed,
      [
        '.claude/agents/retired-agent.md',
        '.claude/skills/old-skill/SKILL.md',
        '.codex/agents/old.toml',
      ]
    );
    assert.equal(existsSync(zombieSkillPath), true);
    assert.equal(existsSync(zombieClaudeAgentPath), true);
    assert.equal(existsSync(zombieCodexPath), true);

    // 2. clean: true deletes zombie files, prunes empty skill dir, preserves non-managed files
    const cleanRes = syncTools(dir, { target: 'all', clean: true });
    assert.deepEqual(
      cleanRes.removed,
      [
        '.claude/agents/retired-agent.md',
        '.claude/skills/old-skill/SKILL.md',
        '.codex/agents/old.toml',
      ]
    );
    assert.equal(existsSync(zombieSkillPath), false);
    assert.equal(existsSync(path.join(dir, '.claude', 'skills', 'old-skill')), false);
    assert.equal(existsSync(zombieClaudeAgentPath), false);
    assert.equal(existsSync(zombieCodexPath), false);
    assert.equal(existsSync(claudeSettingsPath), true);
    assert.equal(existsSync(cursorCustomRulePath), true);
  });

  it('check: true detects missing, drifted, and stale files without modifying disk and supports CLI --check', () => {
    const dir = createTempWorkspace();

    // 1. Before sync -> inSync: false (missing files recorded in drifted)
    const beforeRes = syncTools(dir, { target: 'all', check: true });
    assert.equal(beforeRes.check, true);
    assert.equal(beforeRes.inSync, false);
    assert.ok(beforeRes.drifted.length > 0);
    assert.deepEqual(beforeRes.stale, []);
    assert.equal(existsSync(path.join(dir, '.claude')), false);

    // 2. Right after sync -> inSync: true
    syncTools(dir, { target: 'all' });
    const afterSyncRes = syncTools(dir, { target: 'all', check: true });
    assert.equal(afterSyncRes.inSync, true);
    assert.deepEqual(afterSyncRes.drifted, []);
    assert.deepEqual(afterSyncRes.stale, []);

    // 3. Modify a synced file -> inSync: false, drifted contains modified file
    const webDevClaudePath = path.join(dir, '.claude', 'agents', 'web-dev.md');
    writeFileSync(webDevClaudePath, '# Tampered content\n', 'utf8');
    const driftedRes = syncTools(dir, { target: 'all', check: true });
    assert.equal(driftedRes.inSync, false);
    assert.deepEqual(driftedRes.drifted, ['.claude/agents/web-dev.md']);
    assert.deepEqual(driftedRes.stale, []);

    // Restore via sync, then add a zombie file -> inSync: false, stale contains zombie file
    syncTools(dir, { target: 'all' });
    const staleSkillPath = path.join(dir, '.claude', 'skills', 'zombie', 'SKILL.md');
    mkdirSync(path.dirname(staleSkillPath), { recursive: true });
    writeFileSync(staleSkillPath, '# Stale\n', 'utf8');
    const staleRes = syncTools(dir, { target: 'all', check: true });
    assert.equal(staleRes.inSync, false);
    assert.deepEqual(staleRes.drifted, []);
    assert.deepEqual(staleRes.stale, ['.claude/skills/zombie/SKILL.md']);
    // Confirm check: true never deleted the stale file
    assert.equal(existsSync(staleSkillPath), true);

    // 4. Verify CLI --check exits 1 when stale/drifted, and exits 0 after --clean sync (in isolated temp workspace)
    const tempScriptsDir = path.join(dir, 'scripts');
    mkdirSync(tempScriptsDir, { recursive: true });
    cpSync(SYNC_SCRIPT_PATH, path.join(tempScriptsDir, 'sync-tools.mjs'));
    cpSync(
      path.join(__dirname, 'validate-agents.mjs'),
      path.join(tempScriptsDir, 'validate-agents.mjs')
    );

    const cliFail = spawnSync(
      process.execPath,
      [path.join(tempScriptsDir, 'sync-tools.mjs'), '--target=all', '--check'],
      { encoding: 'utf8' }
    );
    assert.equal(cliFail.status, 1);
    assert.match(cliFail.stderr, /zombie\/SKILL\.md/);

    const cliClean = spawnSync(
      process.execPath,
      [path.join(tempScriptsDir, 'sync-tools.mjs'), '--target=all', '--clean'],
      { encoding: 'utf8' }
    );
    assert.equal(cliClean.status, 0);

    const cliPass = spawnSync(
      process.execPath,
      [path.join(tempScriptsDir, 'sync-tools.mjs'), '--target=all', '--check'],
      { encoding: 'utf8' }
    );
    assert.equal(cliPass.status, 0);
  });
});
