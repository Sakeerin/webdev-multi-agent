import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_AGENT_TOOLS,
  MAX_AGENTS_MD_BYTES,
  parseFrontmatter,
  validateWorkspace,
} from './validate-agents.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function writeFixtureFile(rootDir, relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
}

function createValidFixture(rootDir) {
  writeFixtureFile(
    rootDir,
    'AGENTS.md',
    [
      '# AGENTS.md',
      '',
      'Pipeline stages: Plan, Design, Build, Verify, Secure, Ship.',
      'Sub-agents: `web-dev`, `security-auditor`.',
      '',
    ].join('\n')
  );
  writeFixtureFile(rootDir, 'CLAUDE.md', '@AGENTS.md\n');
  writeFixtureFile(rootDir, 'GEMINI.md', '@AGENTS.md\n');

  writeFixtureFile(
    rootDir,
    '.agents/agents/web-dev.md',
    [
      '---',
      'name: web-dev',
      'description: >-',
      '  Frontend engineer handling',
      '  Design and Build.',
      'skills:',
      '  - frontend-ui-engineering',
      'tools: [read_file, write_file, edit_file]',
      '---',
      '',
      '# Web Dev',
      '',
      'Build 375px mobile-first UI.',
      '',
    ].join('\n')
  );

  writeFixtureFile(
    rootDir,
    '.agents/agents/security-auditor.md',
    [
      '---',
      'name: security-auditor',
      'description: Read-only security auditor.',
      'skills:',
      '  - security-and-hardening',
      'tools:',
      '  - read_file',
      '  - run_command',
      '---',
      '',
      '# Security Auditor',
      '',
      'Audit code in read-only mode.',
      '',
    ].join('\n')
  );

  writeFixtureFile(
    rootDir,
    '.agents/skills/frontend-ui-engineering/SKILL.md',
    [
      '---',
      'name: frontend-ui-engineering',
      'description: Build accessible 375px mobile-first UI.',
      '---',
      '',
      '# Frontend UI Engineering',
      '',
      'Start at 375px.',
      '',
    ].join('\n')
  );

  writeFixtureFile(
    rootDir,
    '.agents/skills/security-and-hardening/SKILL.md',
    [
      '---',
      'name: security-and-hardening',
      'description: Audit XSS, auth, secrets, and headers.',
      '---',
      '',
      '# Security and Hardening',
      '',
      'Check auth and input boundaries.',
      '',
    ].join('\n')
  );
}

describe('parseFrontmatter', () => {
  it('parses inline scalars, folded multiline scalars, literal scalars, lists, inline arrays, and CRLF', () => {
    const raw = [
      '---',
      'name: "web-dev"',
      'description: >-',
      '  Multi-line folded',
      '  description text.',
      'notes: |',
      '  Line one',
      '  Line two',
      'skills:',
      '  - frontend-ui-engineering',
      '  - impeccable',
      'tools: [read_file, write_file]',
      '---',
      '',
      '# Heading',
      'Body content.',
    ].join('\r\n');

    const parsed = parseFrontmatter(raw);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.data.name, 'web-dev');
    assert.equal(parsed.data.description, 'Multi-line folded description text.');
    assert.equal(parsed.data.notes, 'Line one\nLine two');
    assert.deepEqual(parsed.data.skills, ['frontend-ui-engineering', 'impeccable']);
    assert.deepEqual(parsed.data.tools, ['read_file', 'write_file']);
    assert.equal(parsed.body.trim(), '# Heading\nBody content.');
  });

  it('rejects missing opening fence, unclosed fence, and empty frontmatter', () => {
    assert.equal(parseFrontmatter('# No frontmatter\n').ok, false);
    assert.equal(parseFrontmatter('---\nname: test\n').ok, false);
    assert.equal(parseFrontmatter('---\n\n---\n# Body\n').ok, false);
  });
});

describe('validateWorkspace (real repository)', () => {
  it('validates the live repository cleanly with zero errors and zero warnings', () => {
    const result = validateWorkspace(REPO_ROOT);
    assert.equal(result.ok, true, `Unexpected errors: ${result.errors.join('; ')}`);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.summary.agents, 4);
    assert.equal(result.summary.skills, 9);
    assert.ok(result.summary.agentsMdBytes > 0 && result.summary.agentsMdBytes <= MAX_AGENTS_MD_BYTES);
  });
});

describe('validateWorkspace (fixture edge cases)', () => {
  const tempDirs = [];

  function makeFixture() {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'validate-agents-test-'));
    tempDirs.push(dir);
    createValidFixture(dir);
    return dir;
  }

  after(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes on a minimal valid fixture', () => {
    const dir = makeFixture();
    const result = validateWorkspace(dir);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
  });

  it('fails when AGENTS.md is missing, oversized (>24000 bytes), or has frontmatter', () => {
    const missingDir = makeFixture();
    unlinkSync(path.join(missingDir, 'AGENTS.md'));
    const missingRes = validateWorkspace(missingDir);
    assert.equal(missingRes.ok, false);
    assert.ok(missingRes.errors.some((e) => /AGENTS\.md/.test(e)));

    const bigDir = makeFixture();
    writeFixtureFile(
      bigDir,
      'AGENTS.md',
      `Plan Design Build Verify Secure Ship web-dev security-auditor\n${'x'.repeat(24050)}`
    );
    const bigRes = validateWorkspace(bigDir);
    assert.equal(bigRes.ok, false);
    assert.ok(bigRes.errors.some((e) => /24000/.test(e)));

    const fmDir = makeFixture();
    writeFixtureFile(
      fmDir,
      'AGENTS.md',
      '---\ntitle: invalid\n---\nPlan Design Build Verify Secure Ship web-dev security-auditor\n'
    );
    const fmRes = validateWorkspace(fmDir);
    assert.equal(fmRes.ok, false);
    assert.ok(fmRes.errors.some((e) => /frontmatter/i.test(e)));
  });

  it('fails when CLAUDE.md or GEMINI.md is missing or does not include @AGENTS.md', () => {
    const dir = makeFixture();
    writeFixtureFile(dir, 'CLAUDE.md', '# Custom rules only\n');
    const res = validateWorkspace(dir);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /@AGENTS\.md/.test(e)));

    const missingGeminiDir = makeFixture();
    unlinkSync(path.join(missingGeminiDir, 'GEMINI.md'));
    const missingGeminiRes = validateWorkspace(missingGeminiDir);
    assert.equal(missingGeminiRes.ok, false);
    assert.ok(missingGeminiRes.errors.some((e) => /GEMINI\.md/.test(e)));

    const badGeminiDir = makeFixture();
    writeFixtureFile(badGeminiDir, 'GEMINI.md', '# Missing import\n');
    const badGeminiRes = validateWorkspace(badGeminiDir);
    assert.equal(badGeminiRes.ok, false);
    assert.ok(badGeminiRes.errors.some((e) => /GEMINI\.md|@AGENTS\.md/.test(e)));
  });

  it('fails on sub-agent name mismatch or missing skill reference', () => {
    const mismatchDir = makeFixture();
    writeFixtureFile(
      mismatchDir,
      '.agents/agents/web-dev.md',
      [
        '---',
        'name: wrong-name',
        'description: Mismatched name.',
        'skills: [frontend-ui-engineering]',
        'tools: [read_file]',
        '---',
        'Body',
      ].join('\n')
    );
    const mismatchRes = validateWorkspace(mismatchDir);
    assert.equal(mismatchRes.ok, false);

    const missingSkillDir = makeFixture();
    writeFixtureFile(
      missingSkillDir,
      '.agents/agents/web-dev.md',
      [
        '---',
        'name: web-dev',
        'description: Missing skill.',
        'skills: [non-existent-skill]',
        'tools: [read_file]',
        '---',
        'Body',
      ].join('\n')
    );
    const missingSkillRes = validateWorkspace(missingSkillDir);
    assert.equal(missingSkillRes.ok, false);
    assert.ok(missingSkillRes.errors.some((e) => /non-existent-skill/.test(e)));
  });

  it('fails when security-auditor grants write tools (write_file / edit_file)', () => {
    const dir = makeFixture();
    writeFixtureFile(
      dir,
      '.agents/agents/security-auditor.md',
      [
        '---',
        'name: security-auditor',
        'description: Auditor with unsafe write tool.',
        'skills: [security-and-hardening]',
        'tools: [read_file, write_file]',
        '---',
        'Audit body.',
      ].join('\n')
    );
    const res = validateWorkspace(dir);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /read-only|write_file/i.test(e)));
  });

  it('fails when a skill lacks SKILL.md, has mismatched/uppercase name, missing description, or empty body', () => {
    const noSkillMdDir = makeFixture();
    mkdirSync(path.join(noSkillMdDir, '.agents/skills/empty-skill'), { recursive: true });
    const noSkillMdRes = validateWorkspace(noSkillMdDir);
    assert.equal(noSkillMdRes.ok, false);
    assert.ok(noSkillMdRes.errors.some((e) => /SKILL\.md/.test(e)));

    const badNameDir = makeFixture();
    writeFixtureFile(
      badNameDir,
      '.agents/skills/frontend-ui-engineering/SKILL.md',
      '---\nname: FrontendUI\ndescription: Valid desc.\n---\nBody.\n'
    );
    assert.equal(validateWorkspace(badNameDir).ok, false);

    const noDescDir = makeFixture();
    writeFixtureFile(
      noDescDir,
      '.agents/skills/frontend-ui-engineering/SKILL.md',
      '---\nname: frontend-ui-engineering\n---\nBody.\n'
    );
    assert.equal(validateWorkspace(noDescDir).ok, false);

    const emptyBodyDir = makeFixture();
    writeFixtureFile(
      emptyBodyDir,
      '.agents/skills/frontend-ui-engineering/SKILL.md',
      '---\nname: frontend-ui-engineering\ndescription: Valid desc.\n---\n   \n'
    );
    assert.equal(validateWorkspace(emptyBodyDir).ok, false);
  });

  it('emits a warning (still ok: true) for an unreferenced extra skill directory', () => {
    const dir = makeFixture();
    writeFixtureFile(
      dir,
      '.agents/skills/orphan-helper/SKILL.md',
      [
        '---',
        'name: orphan-helper',
        'description: Unused helper skill.',
        '---',
        '',
        '# Orphan Helper',
        '',
        'Details.',
      ].join('\n')
    );
    const res = validateWorkspace(dir);
    assert.equal(res.ok, true);
    assert.ok(res.warnings.length >= 1);
    assert.ok(res.warnings.some((w) => w.includes('orphan-helper')));
  });

  it('fails when any sub-agent declares auto-injected runtime or MCP tools in tools:', () => {
    for (const disallowedTool of [
      'call_mcp_tool',
      'list_resources',
      'read_resource',
      'send_message',
      'manage_task',
    ]) {
      const dir = makeFixture();
      writeFixtureFile(
        dir,
        '.agents/agents/web-dev.md',
        [
          '---',
          'name: web-dev',
          'description: Uses auto-injected tool in frontmatter.',
          'skills: [frontend-ui-engineering]',
          `tools: [read_file, ${disallowedTool}]`,
          '---',
          'Body',
        ].join('\n')
      );
      const res = validateWorkspace(dir);
      assert.equal(res.ok, false, `Expected failure for ${disallowedTool}`);
      assert.ok(
        res.errors.some((e) => new RegExp(`${disallowedTool}|auto-injected`, 'i').test(e)),
        `Expected error mentioning ${disallowedTool}`
      );
    }
  });

  it('exports ALLOWED_AGENT_TOOLS and rejects unknown, misspelled, or foreign tool names', () => {
    assert.equal(Object.isFrozen(ALLOWED_AGENT_TOOLS), true);
    assert.deepEqual(ALLOWED_AGENT_TOOLS, [
      'read_file',
      'write_file',
      'edit_file',
      'run_command',
      'search_web',
    ]);

    for (const invalidTool of ['read_fle', 'Bash']) {
      const dir = makeFixture();
      writeFixtureFile(
        dir,
        '.agents/agents/web-dev.md',
        [
          '---',
          'name: web-dev',
          'description: Uses invalid tool name.',
          'skills: [frontend-ui-engineering]',
          `tools: [read_file, ${invalidTool}]`,
          '---',
          'Body',
        ].join('\n')
      );
      const res = validateWorkspace(dir);
      assert.equal(res.ok, false, `Expected failure for invalid tool "${invalidTool}"`);
      assert.ok(
        res.errors.some(
          (e) => e.includes(invalidTool) && /ALLOWED_AGENT_TOOLS|Allowed tools|unknown/i.test(e)
        ),
        `Expected error mentioning ${invalidTool} and ALLOWED_AGENT_TOOLS, got: ${res.errors.join('; ')}`
      );
    }

    const searchWebDir = makeFixture();
    writeFixtureFile(
      searchWebDir,
      '.agents/agents/web-dev.md',
      [
        '---',
        'name: web-dev',
        'description: Uses search_web tool.',
        'skills: [frontend-ui-engineering]',
        'tools: [read_file, search_web]',
        '---',
        'Body',
      ].join('\n')
    );
    assert.equal(validateWorkspace(searchWebDir).ok, true);
  });

  it('validates relative Markdown links across .agents/ while ignoring code spans/fences and external schemes', () => {
    // 1. Valid relative links, fragments, titles, code blocks, and external schemes -> PASS
    const validDir = makeFixture();
    writeFixtureFile(
      validDir,
      '.agents/skills/frontend-ui-engineering/references/check.md',
      [
        '# Reference Check',
        '',
        'Back to [skill](../SKILL.md#steps).',
      ].join('\n')
    );
    writeFixtureFile(
      validDir,
      '.agents/skills/frontend-ui-engineering/SKILL.md',
      [
        '---',
        'name: frontend-ui-engineering',
        'description: Build accessible 375px mobile-first UI.',
        '---',
        '',
        '# Frontend UI Engineering',
        '',
        'See [checklist](./references/check.md) and [titled](./references/check.md "Checklist").',
        'Jump to [section](#steps) or [docs](https://example.com/docs) or [mail](mailto:dev@example.com).',
        'Ignore [local](file:///tmp/demo.md) and [conv](conversation://abc).',
        'Ignore inline `[inline-fake](./nope-inline.md)` link.',
        '',
        '```markdown',
        '[fake](./does-not-exist.md)',
        '```',
        '',
        '~~~markdown',
        '[fake-tilde](./still-does-not-exist.md)',
        '~~~',
        '',
      ].join('\n')
    );
    const validRes = validateWorkspace(validDir);
    assert.equal(validRes.ok, true, `Unexpected errors: ${validRes.errors.join('; ')}`);

    // 2. Broken relative link in skill -> FAIL
    const brokenSkillDir = makeFixture();
    writeFixtureFile(
      brokenSkillDir,
      '.agents/skills/frontend-ui-engineering/SKILL.md',
      [
        '---',
        'name: frontend-ui-engineering',
        'description: Build accessible 375px mobile-first UI.',
        '---',
        '',
        'See [missing](./references/nope.md).',
      ].join('\n')
    );
    const brokenSkillRes = validateWorkspace(brokenSkillDir);
    assert.equal(brokenSkillRes.ok, false);
    assert.ok(brokenSkillRes.errors.some((e) => e.includes('./references/nope.md')));

    // 3. Broken relative link in agent -> FAIL
    const brokenAgentDir = makeFixture();
    writeFixtureFile(
      brokenAgentDir,
      '.agents/agents/web-dev.md',
      [
        '---',
        'name: web-dev',
        'description: Frontend engineer.',
        'skills: [frontend-ui-engineering]',
        'tools: [read_file]',
        '---',
        '',
        'Read [missing-doc](./missing-agent-ref.md).',
      ].join('\n')
    );
    const brokenAgentRes = validateWorkspace(brokenAgentDir);
    assert.equal(brokenAgentRes.ok, false);
    assert.ok(brokenAgentRes.errors.some((e) => e.includes('./missing-agent-ref.md')));

    // 4. Relative link escaping rootDir -> FAIL
    const escapeDir = makeFixture();
    writeFixtureFile(
      escapeDir,
      '.agents/skills/frontend-ui-engineering/SKILL.md',
      [
        '---',
        'name: frontend-ui-engineering',
        'description: Build accessible 375px mobile-first UI.',
        '---',
        '',
        'Bad [escape](../../../../etc/passwd).',
      ].join('\n')
    );
    const escapeRes = validateWorkspace(escapeDir);
    assert.equal(escapeRes.ok, false);
    assert.ok(
      escapeRes.errors.some((e) => e.includes('../../../../etc/passwd') && /outside|escape|root/i.test(e)),
      `Expected root escape error, got: ${escapeRes.errors.join('; ')}`
    );
  });
});
