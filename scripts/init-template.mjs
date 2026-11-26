import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { validateWorkspace } from './validate-agents.mjs';

export const BLANK_PLAN_TEMPLATE = [
  '# PLAN.md — Task Execution Plan',
  '',
  '> Maintained by the Main Agent during **Step 1 (Plan)** per `AGENTS.md` before delegating to sub-agents.',
  '',
  '## 1. Goal & Scope',
  '- **Task**: `<Short description of the feature, bugfix, or refactor>`',
  '- **User Value**: `<Why this matters to the user>`',
  '- **Out of Scope**: `<What we will explicitly NOT change in this task>`',
  '',
  '## 2. Acceptance Criteria',
  '- [ ] **Design (`375px` mobile-first)**: Component/layout spec or Stitch HTML reference with responsive breakpoints (`N/A (non-UI)` only for non-UI tasks).',
  '- [ ] **Build (Incremental + TDD)**: Small, focused commits with tests written/updated first; `lint`, `typecheck`, `test`, and `build` pass.',
  '- [ ] **Verify (Automated + Browser)**: Automated tests pass; mobile (`375px`) and desktop screenshots inspected; mobile `LCP <= 2.5s`, `INP <= 200ms`, `CLS <= 0.1`; zero console/network errors.',
  '- [ ] **Secure (Audit + Rules)**: `security-auditor` reports `PASS` with `0` Critical/High findings across auth, validation, secrets, dependencies, and DB/Firebase rules.',
  '- [ ] **Ship (CI & Release)**: Pre-launch checklist complete, `.github/workflows/ci.yml` gates green, and PR ready.',
  '',
  '## 3. Edge Cases & Risks',
  '- `<List boundary conditions, invalid inputs, failure modes, and assumptions>`',
  '',
  '## 4. Step-by-Step Pipeline Tracker',
  '',
  '| # | Stage | Owner | Task Details | Status | Proof |',
  '| :--- | :--- | :--- | :--- | :---: | :--- |',
  '| 1 | Plan | Main Agent | Define scope, acceptance criteria & edge cases | [ ] | `PLAN.md` |',
  '| 2 | Design | `web-dev` | `375px` mobile-first UI spec (or `N/A (non-UI)`) | [ ] | Pending |',
  '| 3 | Build | `web-dev` | Incremental vertical slices + tests first | [ ] | Pending |',
  '| 4 | Verify | `tester` | Automated tests + DevTools mobile/desktop & CWV | [ ] | Pending |',
  '| 5 | Secure | `security-auditor` | Auth, input validation, secrets, deps & rules audit | [ ] | Pending |',
  '| 6 | Ship | `devops` | CI gates, pre-launch checklist & PR preparation | [ ] | Pending |',
  '',
  '## 5. Circuit Breaker State',
  '- `web-dev` failures: `0 / 2`',
  '- `tester` failures: `0 / 2`',
  '- `security-auditor` failures: `0 / 2`',
  '- `devops` failures: `0 / 2`',
  '',
].join('\n');

function assertDirectChildPath(resolvedRoot, childName) {
  const targetPath = path.resolve(resolvedRoot, childName);
  const rel = path.relative(resolvedRoot, targetPath);
  if (rel !== childName || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing path operation outside repository root: ${targetPath}`);
  }
  return targetPath;
}

function isSymlinkPath(targetPath) {
  return Boolean(lstatSync(targetPath, { throwIfNoEntry: false })?.isSymbolicLink());
}

export function initTemplate(rootDir, { dryRun = false } = {}) {
  const resolvedRoot = path.resolve(rootDir);

  if (
    !existsSync(path.join(resolvedRoot, 'AGENTS.md')) ||
    !existsSync(path.join(resolvedRoot, '.agents'))
  ) {
    throw new Error(
      `Refusing to initialize template in "${resolvedRoot}": missing required AGENTS.md or .agents/ directory.`
    );
  }

  const demoAppDir = assertDirectChildPath(resolvedRoot, 'demo-app');
  const planMdPath = assertDirectChildPath(resolvedRoot, 'PLAN.md');
  const packageJsonPath = assertDirectChildPath(resolvedRoot, 'package.json');

  if (isSymlinkPath(demoAppDir)) {
    throw new Error(`Refusing to remove symbolic link at ${demoAppDir}.`);
  }
  if (isSymlinkPath(planMdPath)) {
    throw new Error(`Refusing to overwrite symbolic link at ${planMdPath}.`);
  }
  if (isSymlinkPath(packageJsonPath)) {
    throw new Error(`Refusing to modify symbolic link at ${packageJsonPath}.`);
  }

  const hasDemoApp = existsSync(demoAppDir);

  let parsedPkg = null;
  let cleanedPackageScripts = [];
  if (existsSync(packageJsonPath)) {
    let rawPkg;
    try {
      rawPkg = readFileSync(packageJsonPath, 'utf8');
      parsedPkg = JSON.parse(rawPkg);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot parse package.json at ${packageJsonPath}: ${detail}`);
    }
    if (!parsedPkg || typeof parsedPkg !== 'object' || Array.isArray(parsedPkg)) {
      throw new Error(`Invalid package.json root object at ${packageJsonPath}.`);
    }
    if (
      parsedPkg.scripts &&
      typeof parsedPkg.scripts === 'object' &&
      !Array.isArray(parsedPkg.scripts)
    ) {
      cleanedPackageScripts = Object.keys(parsedPkg.scripts).filter((key) =>
        key.startsWith('demo:')
      );
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      removedDemoApp: hasDemoApp,
      updatedPlan: 'PLAN.md',
      cleanedPackageScripts,
      validation: null,
    };
  }

  if (hasDemoApp) {
    rmSync(demoAppDir, { recursive: true, force: false });
  }

  if (parsedPkg && cleanedPackageScripts.length > 0) {
    for (const scriptKey of cleanedPackageScripts) {
      delete parsedPkg.scripts[scriptKey];
    }
    writeFileSync(packageJsonPath, `${JSON.stringify(parsedPkg, null, 2)}\n`, 'utf8');
  }

  writeFileSync(planMdPath, BLANK_PLAN_TEMPLATE, 'utf8');

  const validation = validateWorkspace(resolvedRoot);
  if (!validation.ok) {
    throw new Error(
      `Workspace validation failed after template initialization: ${validation.errors.join('; ')}`
    );
  }

  return {
    dryRun: false,
    removedDemoApp: hasDemoApp,
    updatedPlan: 'PLAN.md',
    cleanedPackageScripts,
    validation,
  };
}

function parseCliArgs(argv) {
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true, dryRun };
    } else {
      throw new Error(`Unknown argument: "${arg}".`);
    }
  }

  return { help: false, dryRun };
}

const USAGE_TEXT = 'Usage: node scripts/init-template.mjs [--dry-run]';

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
    const result = initTemplate(rootDir, { dryRun: args.dryRun });
    const scriptsSuffix =
      result.cleanedPackageScripts.length > 0
        ? ` (${result.dryRun ? 'would strip' : 'stripped'} ${result.cleanedPackageScripts.join(', ')} from package.json)`
        : '';
    if (result.dryRun) {
      const demoNote = result.removedDemoApp
        ? 'would remove demo-app/ and reset PLAN.md'
        : 'demo-app/ already absent; would reset PLAN.md';
      console.log(`Dry-run complete: ${demoNote}${scriptsSuffix}.`);
    } else {
      const demoNote = result.removedDemoApp
        ? 'removed demo-app/ and reset PLAN.md'
        : 'reset PLAN.md (demo-app/ already absent)';
      console.log(`Template initialized: ${demoNote}${scriptsSuffix}. Playbook validation passed.`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(USAGE_TEXT);
    process.exit(1);
  }
}
