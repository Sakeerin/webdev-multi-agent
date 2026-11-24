import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseFrontmatter } from './validate-agents.mjs';

export const SUPPORTED_TARGETS = Object.freeze(['claude', 'cursor', 'gemini', 'codex']);

const CLAUDE_TOOL_MAP = Object.freeze({
  read_file: Object.freeze(['Read', 'Glob', 'Grep']),
  write_file: Object.freeze(['Write']),
  edit_file: Object.freeze(['Edit']),
  run_command: Object.freeze(['Bash']),
  search_web: Object.freeze(['WebSearch']),
});

export function mapClaudeTools(tools = []) {
  const mapped = [];
  const seen = new Set();
  for (const tool of tools) {
    const claudeTools = CLAUDE_TOOL_MAP[tool];
    if (!claudeTools) {
      continue;
    }
    for (const claudeTool of claudeTools) {
      if (!seen.has(claudeTool)) {
        seen.add(claudeTool);
        mapped.push(claudeTool);
      }
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

function assertInsideDir(baseDir, candidatePath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidatePath);
  const rel = path.relative(resolvedBase, resolvedCandidate);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing path operation outside managed directory: ${candidatePath}`);
  }
  return resolvedCandidate;
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

function collectExistingManagedFiles(resolvedRoot, targets) {
  const managedFiles = [];

  for (const currentTarget of targets) {
    if (currentTarget === 'codex') {
      const codexAgentsDir = path.join(resolvedRoot, '.codex', 'agents');
      if (existsSync(codexAgentsDir)) {
        const entries = readdirSync(codexAgentsDir, { withFileTypes: true }).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.toml')) {
            const absPath = assertInsideDir(codexAgentsDir, path.join(codexAgentsDir, entry.name));
            managedFiles.push({ posixRel: `.codex/agents/${entry.name}`, absPath });
          }
        }
      }
      continue;
    }

    const toolDir = `.${currentTarget}`;
    const agentsManagedDir = path.join(resolvedRoot, toolDir, 'agents');
    if (existsSync(agentsManagedDir)) {
      const entries = readdirSync(agentsManagedDir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const absPath = assertInsideDir(
            agentsManagedDir,
            path.join(agentsManagedDir, entry.name)
          );
          managedFiles.push({ posixRel: `${toolDir}/agents/${entry.name}`, absPath });
        }
      }
    }

    const skillsManagedDir = path.join(resolvedRoot, toolDir, 'skills');
    if (existsSync(skillsManagedDir)) {
      for (const item of collectFilesRecursive(skillsManagedDir)) {
        const absPath = assertInsideDir(skillsManagedDir, item.fullPath);
        managedFiles.push({ posixRel: `${toolDir}/skills/${item.relPath}`, absPath });
      }
    }
  }

  return managedFiles;
}

function pruneEmptyDirsRecursive(skillsRootDir, currentDir = skillsRootDir) {
  if (!existsSync(currentDir)) {
    return;
  }
  const entries = readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const childDir = assertInsideDir(skillsRootDir, path.join(currentDir, entry.name));
      pruneEmptyDirsRecursive(skillsRootDir, childDir);
    }
  }
  if (currentDir !== skillsRootDir && readdirSync(currentDir).length === 0) {
    assertInsideDir(skillsRootDir, currentDir);
    rmdirSync(currentDir);
  }
}

export function syncTools(
  rootDir,
  { target = 'all', dryRun = false, clean = false, check = false } = {}
) {
  if (target !== 'all' && !SUPPORTED_TARGETS.includes(target)) {
    throw new Error(
      `Unsupported target "${target}". Supported targets: all, ${SUPPORTED_TARGETS.join(', ')}.`
    );
  }

  const resolvedRoot = path.resolve(rootDir);
  const agentsDir = path.join(resolvedRoot, '.agents', 'agents');
  const skillsDir = path.join(resolvedRoot, '.agents', 'skills');

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

  const plannedEntries = [];
  const addPlannedFile = (relPath, contentBufferOrString) => {
    const posixRel = relPath.replaceAll('\\', '/');
    const absPath = assertInsideDir(resolvedRoot, path.join(resolvedRoot, relPath));
    const buffer = Buffer.isBuffer(contentBufferOrString)
      ? contentBufferOrString
      : Buffer.from(contentBufferOrString, 'utf8');
    plannedEntries.push({ posixRel, absPath, buffer });
  };

  for (const currentTarget of targets) {
    if (currentTarget === 'codex') {
      for (const agent of parsedAgents) {
        const tomlContent = renderCodexToml({
          name: agent.data.name ?? agent.stem,
          description: agent.data.description ?? '',
          skills: Array.isArray(agent.data.skills) ? agent.data.skills : [],
          body: agent.body,
        });
        addPlannedFile(`.codex/agents/${agent.stem}.toml`, tomlContent);
      }
      continue;
    }

    const toolDir = `.${currentTarget}`;

    for (const agent of parsedAgents) {
      const renderedAgent =
        currentTarget === 'claude'
          ? renderClaudeAgentMarkdown(agent)
          : renderMirroredMarkdown(agent);
      addPlannedFile(`${toolDir}/agents/${agent.stem}.md`, renderedAgent);
    }

    for (const skillFile of skillFiles) {
      addPlannedFile(`${toolDir}/skills/${skillFile.relPath}`, skillFile.content);
    }
  }

  const files = plannedEntries.map((entry) => entry.posixRel);
  const plannedSet = new Set(files);
  const existingManaged =
    clean || check ? collectExistingManagedFiles(resolvedRoot, targets) : [];
  const staleItems = existingManaged.filter((item) => !plannedSet.has(item.posixRel));
  const stale = staleItems.map((item) => item.posixRel);
  const removed = clean ? [...stale] : [];

  if (check) {
    const drifted = [];
    for (const entry of plannedEntries) {
      if (!existsSync(entry.absPath) || !readFileSync(entry.absPath).equals(entry.buffer)) {
        drifted.push(entry.posixRel);
      }
    }
    return {
      targets,
      dryRun,
      check: true,
      inSync: drifted.length === 0 && stale.length === 0,
      files,
      removed,
      drifted,
      stale,
    };
  }

  if (!dryRun) {
    for (const entry of plannedEntries) {
      mkdirSync(path.dirname(entry.absPath), { recursive: true });
      writeFileSync(entry.absPath, entry.buffer);
    }

    if (clean) {
      for (const item of staleItems) {
        unlinkSync(item.absPath);
      }
      for (const currentTarget of targets) {
        if (currentTarget !== 'codex') {
          pruneEmptyDirsRecursive(path.join(resolvedRoot, `.${currentTarget}`, 'skills'));
        }
      }
    }
  }

  return { targets, dryRun, check: false, files, removed };
}

function parseCliArgs(argv) {
  let target = 'all';
  let dryRun = false;
  let clean = false;
  let check = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--clean') {
      clean = true;
    } else if (arg === '--check') {
      check = true;
    } else if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
    } else if (arg === '--help' || arg === '-h') {
      return { help: true, target, dryRun, clean, check };
    } else {
      throw new Error(`Unknown argument: "${arg}".`);
    }
  }

  return { help: false, target, dryRun, clean, check };
}

const USAGE_TEXT = `Usage: node scripts/sync-tools.mjs [--target=all|${SUPPORTED_TARGETS.join('|')}] [--dry-run] [--clean] [--check]`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    if (args.help) {
      console.log(USAGE_TEXT);
      process.exit(0);
    }

    const rootDir = path.resolve(__dirname, '..');
    const result = syncTools(rootDir, {
      target: args.target,
      dryRun: args.dryRun,
      clean: args.clean,
      check: args.check,
    });

    if (args.check) {
      if (result.inSync) {
        console.log(
          `Sync check passed: ${result.files.length} file(s) in sync across target(s) [${result.targets.join(', ')}].`
        );
        process.exit(0);
      }
      console.error(
        `Sync check failed across target(s) [${result.targets.join(', ')}] (${result.drifted.length} drifted, ${result.stale.length} stale):`
      );
      for (const file of result.drifted) {
        console.error(`  - [drifted] ${file}`);
      }
      for (const file of result.stale) {
        console.error(`  - [stale] ${file}`);
      }
      process.exit(1);
    }

    const modeLabel = result.dryRun ? 'Dry-run complete' : 'Synced';
    const cleanSuffix = args.clean
      ? ` (${result.removed.length} stale file(s) ${result.dryRun ? 'would be removed' : 'removed'})`
      : '';
    console.log(
      `${modeLabel}: ${result.files.length} file(s) across target(s) [${result.targets.join(', ')}]${cleanSuffix}.`
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(USAGE_TEXT);
    process.exit(1);
  }
}
