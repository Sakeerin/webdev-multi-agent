import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MAX_AGENTS_MD_BYTES = 24000;

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
      data[key] = items;
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
