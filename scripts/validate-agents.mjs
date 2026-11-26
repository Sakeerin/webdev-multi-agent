import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MAX_AGENTS_MD_BYTES = 24000;
export const ALLOWED_AGENT_TOOLS = Object.freeze([
  'read_file',
  'write_file',
  'edit_file',
  'run_command',
  'search_web',
]);

const ALLOWED_AGENT_TOOLS_SET = new Set(ALLOWED_AGENT_TOOLS);
const REQUIRED_PIPELINE_STAGES = ['Plan', 'Design', 'Build', 'Verify', 'Secure', 'Ship'];
const SKILL_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUDITOR_FORBIDDEN_WRITE_TOOLS = new Set([
  'write_file',
  'edit_file',
  'write_to_file',
  'replace_file_content',
]);
const AUTO_INJECTED_DISALLOWED_TOOLS = new Set([
  'call_mcp_tool',
  'list_resources',
  'read_resource',
  'send_message',
  'manage_task',
]);
const SKIPPED_LINK_SCHEME_REGEX = /^(?:https?:\/\/|mailto:|file:\/\/|conversation:\/\/)/i;

function stripQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseFrontmatter(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Frontmatter input must be a string.' };
  }

  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { ok: false, error: 'Missing opening YAML frontmatter fence (---).' };
  }

  const closeIndex = normalized.indexOf('\n---', 3);
  if (closeIndex === -1) {
    return { ok: false, error: 'Missing closing YAML frontmatter fence (---).' };
  }

  const afterFenceIndex = closeIndex + 4;
  const restChar = normalized[afterFenceIndex];
  if (restChar !== undefined && restChar !== '\n') {
    return { ok: false, error: 'Invalid closing YAML frontmatter fence.' };
  }

  const yamlBlock = normalized.slice(4, closeIndex);
  const body = normalized.slice(afterFenceIndex).replace(/^\n/, '');
  const lines = yamlBlock.split('\n');
  const data = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!keyMatch) {
      return { ok: false, error: `Invalid YAML frontmatter line: "${line.trim()}".` };
    }

    const key = keyMatch[1];
    const rawVal = (keyMatch[2] ?? '').trim();

    if (rawVal === '>-' || rawVal === '>' || rawVal === '|-' || rawVal === '|') {
      const isFolded = rawVal.startsWith('>');
      const blockLines = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (/^[ \t]+/.test(next)) {
          blockLines.push(next.trim());
          i += 1;
        } else if (next.trim() === '') {
          if (i + 2 < lines.length && /^[ \t]+/.test(lines[i + 2])) {
            blockLines.push('');
            i += 1;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      data[key] = isFolded
        ? blockLines.filter((entry) => entry.length > 0).join(' ')
        : blockLines.join('\n');
    } else if (rawVal === '') {
      const items = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const itemMatch = next.match(/^\s+-\s+(.*)$/);
        if (itemMatch) {
          items.push(stripQuotes(itemMatch[1].trim()));
          i += 1;
        } else if (next.trim() === '') {
          if (i + 2 < lines.length && /^\s+-\s+/.test(lines[i + 2])) {
            i += 1;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      data[key] = items.length > 0 ? items : '';
    } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      const inner = rawVal.slice(1, -1).trim();
      data[key] =
        inner === ''
          ? []
          : inner
              .split(',')
              .map((entry) => stripQuotes(entry.trim()))
              .filter(Boolean);
    } else {
      data[key] = stripQuotes(rawVal);
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'YAML frontmatter cannot be empty.' };
  }

  return { ok: true, data, body };
}

function stripInlineCodeSpans(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '`') {
      let tickCount = 0;
      while (i + tickCount < text.length && text[i + tickCount] === '`') {
        tickCount += 1;
      }
      const fence = '`'.repeat(tickCount);
      const closeIdx = text.indexOf(fence, i + tickCount);
      if (closeIdx !== -1) {
        i = closeIdx + tickCount;
        continue;
      }
      out += fence;
      i += tickCount;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function stripMarkdownCode(rawMarkdown) {
  const parsed = parseFrontmatter(rawMarkdown);
  const content = (parsed.ok ? parsed.body : rawMarkdown).replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  const keptLines = [];
  let activeFenceChar = null;
  let activeFenceLen = 0;

  for (const line of lines) {
    if (!activeFenceChar) {
      const openMatch = line.match(/^[ \t]*(`{3,}|~{3,})/);
      if (openMatch) {
        activeFenceChar = openMatch[1][0];
        activeFenceLen = openMatch[1].length;
        continue;
      }
      keptLines.push(line);
    } else {
      const closeMatch = line.match(/^[ \t]*(`{3,}|~{3,})[ \t]*$/);
      if (
        closeMatch &&
        closeMatch[1][0] === activeFenceChar &&
        closeMatch[1].length >= activeFenceLen
      ) {
        activeFenceChar = null;
        activeFenceLen = 0;
      }
    }
  }

  return stripInlineCodeSpans(keptLines.join('\n'));
}

function stripOptionalLinkTitle(rawTarget) {
  const trimmed = rawTarget.trim();
  const lastChar = trimmed[trimmed.length - 1];
  if (lastChar === '"' || lastChar === "'") {
    const openQuoteIdx = trimmed.indexOf(lastChar);
    if (openQuoteIdx > 0 && /\s/.test(trimmed[openQuoteIdx - 1])) {
      return trimmed.slice(0, openQuoteIdx).trim();
    }
  }
  return trimmed;
}

function collectMarkdownFilesRecursive(currentDir, results = []) {
  if (!existsSync(currentDir)) {
    return results;
  }
  const entries = readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFilesRecursive(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function validateRelativeMarkdownLinks(rootDir, markdownFilePath, rawContent, errors) {
  const resolvedRoot = path.resolve(rootDir);
  const realRoot = existsSync(resolvedRoot) ? realpathSync(resolvedRoot) : resolvedRoot;
  const relSource = path.relative(resolvedRoot, markdownFilePath).replaceAll('\\', '/');
  const stripped = stripMarkdownCode(rawContent);
  const linkRegex = /\[[^\][\r\n]*\]\(([^)\r\n]*)\)/g;

  for (const match of stripped.matchAll(linkRegex)) {
    const rawTarget = match[1].trim();
    if (rawTarget.length === 0) {
      continue;
    }

    const unwrapped =
      rawTarget.startsWith('<') && rawTarget.endsWith('>')
        ? rawTarget.slice(1, -1).trim()
        : rawTarget;
    const withoutTitle = stripOptionalLinkTitle(unwrapped);

    if (
      withoutTitle.length === 0 ||
      withoutTitle.startsWith('#') ||
      SKIPPED_LINK_SCHEME_REGEX.test(withoutTitle)
    ) {
      continue;
    }

    if (withoutTitle.includes('\0')) {
      errors.push(`Invalid null byte in Markdown link "${rawTarget}" in ${relSource}.`);
      continue;
    }

    const hashIdx = withoutTitle.indexOf('#');
    const relPathPart = (hashIdx === -1 ? withoutTitle : withoutTitle.slice(0, hashIdx)).trim();
    if (relPathPart.length === 0) {
      continue;
    }

    let decodedPathPart;
    try {
      decodedPathPart = decodeURIComponent(relPathPart);
    } catch {
      errors.push(
        `Malformed percent-encoding in Markdown link "${rawTarget}" in ${relSource}.`
      );
      continue;
    }

    if (decodedPathPart.includes('\0')) {
      errors.push(`Invalid null byte in Markdown link "${rawTarget}" in ${relSource}.`);
      continue;
    }

    const resolvedTarget = path.resolve(path.dirname(markdownFilePath), decodedPathPart);
    const relToRoot = path.relative(resolvedRoot, resolvedTarget);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      errors.push(
        `Relative Markdown link "${rawTarget}" in ${relSource} resolves outside repository root.`
      );
      continue;
    }

    if (!existsSync(resolvedTarget)) {
      errors.push(
        `Broken relative Markdown link "${rawTarget}" in ${relSource} (target does not exist).`
      );
      continue;
    }

    const realTarget = realpathSync(resolvedTarget);
    const realRelToRoot = path.relative(realRoot, realTarget);
    if (realRelToRoot.startsWith('..') || path.isAbsolute(realRelToRoot)) {
      errors.push(
        `Relative Markdown link "${rawTarget}" in ${relSource} resolves outside repository root via symlink.`
      );
    }
  }
}

export function validateWorkspace(rootDir) {
  const errors = [];
  const warnings = [];
  let agentsMdBytes = 0;
  let agentsMdContent = '';

  // 1. Validate AGENTS.md
  const agentsMdPath = path.join(rootDir, 'AGENTS.md');
  if (!existsSync(agentsMdPath)) {
    errors.push('Missing required root file: AGENTS.md.');
  } else {
    agentsMdContent = readFileSync(agentsMdPath, 'utf8');
    agentsMdBytes = Buffer.byteLength(agentsMdContent, 'utf8');
    if (agentsMdContent.trim().length === 0) {
      errors.push('AGENTS.md cannot be empty.');
    }
    if (/^---\r?\n/.test(agentsMdContent)) {
      errors.push('AGENTS.md must not include YAML frontmatter (standalone rules file).');
    }
    if (agentsMdBytes > MAX_AGENTS_MD_BYTES) {
      errors.push(
        `AGENTS.md exceeds the ${MAX_AGENTS_MD_BYTES}-byte per-file rule limit (${agentsMdBytes} bytes).`
      );
    }
    for (const stage of REQUIRED_PIPELINE_STAGES) {
      if (!new RegExp(`\\b${stage}\\b`).test(agentsMdContent)) {
        errors.push(`AGENTS.md is missing required pipeline stage "${stage}".`);
      }
    }
    validateRelativeMarkdownLinks(rootDir, agentsMdPath, agentsMdContent, errors);
  }

  for (const optionalDoc of ['README.md', 'CUSTOMIZING.md', '.github/PULL_REQUEST_TEMPLATE.md']) {
    const optionalDocPath = path.join(rootDir, optionalDoc);
    if (existsSync(optionalDocPath) && statSync(optionalDocPath).isFile()) {
      const optionalDocContent = readFileSync(optionalDocPath, 'utf8');
      validateRelativeMarkdownLinks(rootDir, optionalDocPath, optionalDocContent, errors);
    }
  }

  // 2. Validate cross-tool bridge files (CLAUDE.md & GEMINI.md)
  for (const bridgeFile of ['CLAUDE.md', 'GEMINI.md']) {
    const bridgePath = path.join(rootDir, bridgeFile);
    if (!existsSync(bridgePath)) {
      errors.push(`Missing cross-tool bridge file: ${bridgeFile}.`);
    } else {
      const bridgeContent = readFileSync(bridgePath, 'utf8');
      if (!bridgeContent.includes('@AGENTS.md')) {
        errors.push(`${bridgeFile} must import @AGENTS.md.`);
      }
    }
  }

  // 3. Validate .agents/skills/<name>/SKILL.md
  const skillsDir = path.join(rootDir, '.agents', 'skills');
  const discoveredSkills = new Set();

  if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
    errors.push('Missing skills directory: .agents/skills/.');
  } else {
    const skillDirs = readdirSync(skillsDir, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory()
    );
    if (skillDirs.length === 0) {
      errors.push('No skill directories found in .agents/skills/.');
    }

    for (const dirEntry of skillDirs) {
      const dirName = dirEntry.name;
      const skillMdPath = path.join(skillsDir, dirName, 'SKILL.md');
      if (!existsSync(skillMdPath)) {
        errors.push(`Skill directory ".agents/skills/${dirName}/" is missing SKILL.md.`);
        continue;
      }

      const raw = readFileSync(skillMdPath, 'utf8');
      const parsed = parseFrontmatter(raw);
      if (!parsed.ok) {
        errors.push(`Invalid frontmatter in .agents/skills/${dirName}/SKILL.md: ${parsed.error}`);
        continue;
      }

      const { name, description } = parsed.data;
      if (typeof name !== 'string' || !SKILL_NAME_REGEX.test(name)) {
        errors.push(
          `Skill "${dirName}" must declare a lowercase hyphenated frontmatter "name".`
        );
      } else if (name !== dirName) {
        errors.push(
          `Skill frontmatter name "${name}" does not match directory name "${dirName}".`
        );
      }

      if (typeof description !== 'string' || description.trim().length === 0) {
        errors.push(`Skill "${dirName}" must declare a non-empty frontmatter "description".`);
      }

      if (parsed.body.trim().length === 0) {
        errors.push(`Skill "${dirName}" SKILL.md body cannot be empty.`);
      }

      discoveredSkills.add(dirName);
    }

    for (const mdPath of collectMarkdownFilesRecursive(skillsDir)) {
      const mdContent = readFileSync(mdPath, 'utf8');
      validateRelativeMarkdownLinks(rootDir, mdPath, mdContent, errors);
    }
  }

  // 4. Validate .agents/agents/*.md
  const agentsDir = path.join(rootDir, '.agents', 'agents');
  const referencedSkills = new Set();
  let agentCount = 0;

  if (!existsSync(agentsDir) || !statSync(agentsDir).isDirectory()) {
    errors.push('Missing sub-agents directory: .agents/agents/.');
  } else {
    const agentFiles = readdirSync(agentsDir, { withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.md')
    );
    if (agentFiles.length === 0) {
      errors.push('No sub-agent markdown files found in .agents/agents/.');
    }

    for (const fileEntry of agentFiles) {
      agentCount += 1;
      const stem = fileEntry.name.replace(/\.md$/, '');
      const agentPath = path.join(agentsDir, fileEntry.name);
      const raw = readFileSync(agentPath, 'utf8');
      validateRelativeMarkdownLinks(rootDir, agentPath, raw, errors);
      const parsed = parseFrontmatter(raw);

      if (!parsed.ok) {
        errors.push(`Invalid frontmatter in .agents/agents/${fileEntry.name}: ${parsed.error}`);
        continue;
      }

      const { name, description, skills, tools } = parsed.data;
      if (typeof name !== 'string' || name !== stem) {
        errors.push(
          `Sub-agent "${fileEntry.name}" frontmatter name "${String(name)}" must match filename stem "${stem}".`
        );
      }

      if (typeof description !== 'string' || description.trim().length === 0) {
        errors.push(`Sub-agent "${stem}" must declare a non-empty frontmatter "description".`);
      }

      if (!Array.isArray(skills) || skills.length === 0) {
        errors.push(`Sub-agent "${stem}" must list at least one skill in frontmatter "skills".`);
      } else {
        for (const skillName of skills) {
          referencedSkills.add(skillName);
          if (!discoveredSkills.has(skillName)) {
            errors.push(
              `Sub-agent "${stem}" references missing skill "${skillName}" (not found in .agents/skills/).`
            );
          }
        }
      }

      if (!Array.isArray(tools) || tools.length === 0) {
        errors.push(`Sub-agent "${stem}" must declare explicit frontmatter "tools".`);
      } else {
        const autoInjected = tools.filter((tool) => AUTO_INJECTED_DISALLOWED_TOOLS.has(tool));
        if (autoInjected.length > 0) {
          errors.push(
            `Sub-agent "${stem}" must not list auto-injected runtime/MCP tools in "tools" (Antigravity auto-injects them and listing them causes startup failure): ${autoInjected.join(', ')}.`
          );
        }

        const unknownTools = tools.filter(
          (tool) => !ALLOWED_AGENT_TOOLS_SET.has(tool) && !AUTO_INJECTED_DISALLOWED_TOOLS.has(tool)
        );
        if (unknownTools.length > 0) {
          errors.push(
            `Sub-agent "${stem}" declares unknown tool(s) in "tools": ${unknownTools.join(', ')}. Allowed tools (ALLOWED_AGENT_TOOLS): ${ALLOWED_AGENT_TOOLS.join(', ')}.`
          );
        }

        if (name === 'security-auditor') {
          const forbidden = tools.filter((tool) => AUDITOR_FORBIDDEN_WRITE_TOOLS.has(tool));
          if (forbidden.length > 0) {
            errors.push(
              `Sub-agent "security-auditor" must remain read-only and cannot include write tools: ${forbidden.join(', ')}.`
            );
          }
        }
      }

      if (parsed.body.trim().length === 0) {
        errors.push(`Sub-agent "${fileEntry.name}" Markdown body cannot be empty.`);
      }

      if (agentsMdContent && typeof name === 'string' && !agentsMdContent.includes(name)) {
        errors.push(`Sub-agent "${name}" is not referenced in AGENTS.md.`);
      }
    }
  }

  // 5. Warn on unreferenced skills
  for (const skillName of discoveredSkills) {
    if (!referencedSkills.has(skillName)) {
      warnings.push(`Skill "${skillName}" in .agents/skills/ is not assigned to any sub-agent.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      agents: agentCount,
      skills: discoveredSkills.size,
      agentsMdBytes,
    },
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  const rootDir = path.resolve(__dirname, '..');
  const result = validateWorkspace(rootDir);

  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (!result.ok) {
    console.error('Agent playbook validation failed:');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `Agent playbook validation passed: ${result.summary.agents} sub-agents, ${result.summary.skills} skills, AGENTS.md (${result.summary.agentsMdBytes} / ${MAX_AGENTS_MD_BYTES} bytes).`
  );
}
