import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseFrontmatter } from './validate-agents.mjs';

export const SUPPORTED_TARGETS = Object.freeze(['claude', 'cursor', 'gemini', 'codex']);

const CLAUDE_TOOL_MAP = Object.freeze({
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Edit',
  run_command: 'Bash',
});

export function mapClaudeTools(tools = []) {
  const mapped = [];
  const seen = new Set();
  for (const tool of tools) {
    const claudeTool = CLAUDE_TOOL_MAP[tool];
    if (claudeTool && !seen.has(claudeTool)) {
      seen.add(claudeTool);
      mapped.push(claudeTool);
    }
  }
  return mapped;
}

function escapeTomlBasicString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function escapeTomlMultilineString(value) {
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"');
}

export function renderCodexToml({ name, description, skills = [], body = '' }) {
  const skillsArray = skills.map((s) => `"${escapeTomlBasicString(s)}"`).join(', ');
  const normalizedBody = escapeTomlMultilineString(body.trimEnd());
  const trailingNewline = normalizedBody.endsWith('"') ? '\n' : '\n';

  return [
    `# Generated from .agents/agents/${name}.md by scripts/sync-tools.mjs`,
    `name = "${escapeTomlBasicString(name)}"`,
    `description = "${escapeTomlBasicString(description)}"`,
    `skills = [${skillsArray}]`,
    `instructions = """`,
    normalizedBody,
    `"""${trailingNewline}`,
  ].join('\n');
}

function renderClaudeAgentMarkdown({ stem, data, body }) {
  const mappedTools = mapClaudeTools(Array.isArray(data.tools) ? data.tools : []);
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const skillsLines = skills.map((skill) => `  - ${skill}`).join('\n');

  return [
    '---',
    `name: ${data.name ?? stem}`,
    `description: ${JSON.stringify(data.description ?? '')}`,
    `tools: ${mappedTools.join(', ')}`,
    'skills:',
    skillsLines,
    '---',
    `<!-- Generated from .agents/agents/${stem}.md by scripts/sync-tools.mjs -->`,
    '',
    body.replace(/^\r?\n/, ''),
  ].join('\n');
}

function renderMirroredMarkdown({ stem, raw }) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const marker = `<!-- Generated from .agents/agents/${stem}.md by scripts/sync-tools.mjs -->`;
  const closeIdx = normalized.indexOf('\n---', 3);
  if (closeIdx === -1) {
    return `${marker}\n\n${normalized}`;
  }
  const splitPoint = closeIdx + 4;
  const frontmatterBlock = normalized.slice(0, splitPoint);
  const restBody = normalized.slice(splitPoint).replace(/^\n*/, '');
  return `${frontmatterBlock}\n${marker}\n\n${restBody}`;
}

function collectFilesRecursive(baseDir, currentDir = baseDir, results = []) {
  if (!existsSync(currentDir)) {
    return results;
  }
  const entries = readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(baseDir, fullPath, results);
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replaceAll('\\', '/');
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

function writeOutputFile(rootDir, relPath, contentBufferOrString, dryRun, recordedFiles) {
  const posixRel = relPath.replaceAll('\\', '/');
  recordedFiles.push(posixRel);
  if (dryRun) {
    return;
  }
  const absPath = path.join(rootDir, relPath);
  mkdirSync(path.dirname(absPath), { recursive: true });
  writeFileSync(absPath, contentBufferOrString);
}

export function syncTools(rootDir, { target = 'all', dryRun = false } = {}) {
  if (target !== 'all' && !SUPPORTED_TARGETS.includes(target)) {
    throw new Error(
      `Unsupported target "${target}". Supported targets: all, ${SUPPORTED_TARGETS.join(', ')}.`
    );
  }

  const agentsDir = path.join(rootDir, '.agents', 'agents');
  const skillsDir = path.join(rootDir, '.agents', 'skills');

  if (!existsSync(agentsDir)) {
    throw new Error(`Missing source sub-agents directory: ${agentsDir}`);
  }
  if (!existsSync(skillsDir)) {
    throw new Error(`Missing source skills directory: ${skillsDir}`);
  }

  const targets = target === 'all' ? [...SUPPORTED_TARGETS] : [target];
  const agentFiles = readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parsedAgents = agentFiles.map((entry) => {
    const stem = entry.name.replace(/\.md$/, '');
    const raw = readFileSync(path.join(agentsDir, entry.name), 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed.ok) {
      throw new Error(`Cannot parse .agents/agents/${entry.name}: ${parsed.error}`);
    }
    return { stem, raw, data: parsed.data, body: parsed.body };
  });

  const skillFiles = collectFilesRecursive(skillsDir).map((entry) => ({
    relPath: entry.relPath,
    content: readFileSync(entry.fullPath),
  }));

  const files = [];

  for (const currentTarget of targets) {
    if (currentTarget === 'codex') {
      for (const agent of parsedAgents) {
        const tomlContent = renderCodexToml({
          name: agent.data.name ?? agent.stem,
          description: agent.data.description ?? '',
          skills: Array.isArray(agent.data.skills) ? agent.data.skills : [],
          body: agent.body,
        });
        writeOutputFile(rootDir, `.codex/agents/${agent.stem}.toml`, tomlContent, dryRun, files);
      }
      continue;
    }

    const toolDir = `.${currentTarget}`;

    for (const agent of parsedAgents) {
      const renderedAgent =
        currentTarget === 'claude'
          ? renderClaudeAgentMarkdown(agent)
          : renderMirroredMarkdown(agent);
      writeOutputFile(rootDir, `${toolDir}/agents/${agent.stem}.md`, renderedAgent, dryRun, files);
    }

    for (const skillFile of skillFiles) {
      writeOutputFile(
        rootDir,
        `${toolDir}/skills/${skillFile.relPath}`,
        skillFile.content,
        dryRun,
        files
      );
    }
  }

  return { targets, dryRun, files };
}

function parseCliArgs(argv) {
  let target = 'all';
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
    } else if (arg === '--help' || arg === '-h') {
      return { help: true, target, dryRun };
    } else {
      throw new Error(`Unknown argument: "${arg}".`);
    }
  }

  return { help: false, target, dryRun };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    if (args.help) {
      console.log(
        `Usage: node scripts/sync-tools.mjs [--target=all|${SUPPORTED_TARGETS.join('|')}] [--dry-run]`
      );
      process.exit(0);
    }

    const rootDir = path.resolve(__dirname, '..');
    const result = syncTools(rootDir, { target: args.target, dryRun: args.dryRun });
    const modeLabel = result.dryRun ? 'Dry-run complete' : 'Synced';
    console.log(
      `${modeLabel}: ${result.files.length} file(s) across target(s) [${result.targets.join(', ')}].`
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(
      `Usage: node scripts/sync-tools.mjs [--target=all|${SUPPORTED_TARGETS.join('|')}] [--dry-run]`
    );
    process.exit(1);
  }
}
