# PLAN.md — Phase E: Cleanup & Real-Project Readiness

> Maintained by the Main Agent during **Step 1 (Plan)** per `AGENTS.md`. (`Step 2 Design` and `Step 4 Browser Screenshots/CWV` are marked `N/A (non-UI)` per Non-UI Task Rules. Root `PLAN.md` will be restored to the clean blank template in Step 6 before merge.)

## 1. Goal & Scope
- **Task**: Resolve all Phase E findings across `init-template.mjs` post-init `package.json` cleanup, web-framework `.gitignore` readiness, Cursor `.cursor/rules/orchestrator.mdc` & Codex relative-link sync, the 3 Low security-audit symlink/YAML hardenings, root Markdown link & `%20` / empty-scalar fixes in `validate-agents.mjs`, frontend/shipping skill `references/`, `CUSTOMIZING.md`, and GitHub Actions `v7` alignment.
- **User Value**: Ensures `npm run template:init` leaves zero broken `demo:*` scripts, gives Cursor native `.cursor/rules/` support, closes every remaining low-severity symlink/parser edge case, validates links in `AGENTS.md`/`README.md`, and provides customization & hosting guides for real production apps.
- **Out of Scope**:
  - Altering `demo-app/` UI or deleting `demo-app/` in this template repository.
  - Pushing to `origin` without user confirmation.

## 2. Acceptance Criteria
- [x] **Design**: `N/A (non-UI)` — CLI scripts, validator/sync logic, Markdown references, and CI config only.
- [ ] **Build (`web-dev`, TDD)**:
  - `scripts/init-template.mjs`: uses `lstatSync(..., { throwIfNoEntry: false })?.isSymbolicLink()` (catches dangling symlinks) and strips `demo:lint`, `demo:test`, `demo:build` from root `package.json` on initialization; `.gitignore` expanded for Vite/Next.js/Astro/Playwright/Vitest; test globs updated to `**/*.test.*`.
  - `scripts/sync-tools.mjs`: generates `.cursor/rules/orchestrator.mdc` (`alwaysApply: true`) for `cursor` target (without deleting user-authored `.cursor/rules/*.mdc` on `--clean`), rewrites `](../skills/` -> `](../../.agents/skills/` in Codex TOML instructions, blocks symlinked managed directories, and quotes `name`/`skills` in Claude frontmatter.
  - `scripts/validate-agents.mjs`: returns `''` (not `[]`) for empty YAML scalar keys, decodes `%20` URI sequences in relative links, and validates relative Markdown links in `AGENTS.md`, `README.md`, and `.github/PULL_REQUEST_TEMPLATE.md` (when present).
  - Adds `frontend-ui-engineering/references/responsive-and-a11y-checklist.md`, `shipping-and-launch/references/hosting-configs.md`, and root `CUSTOMIZING.md`.
- [ ] **Verify (`tester`, Non-UI)**:
  - All root & `demo-app` unit tests, lint, build, and dry-runs pass with `0` failures (`N/A (non-UI)` browser screenshots/CWV).
- [ ] **Secure (`security-auditor` + Post-Audit Git Check)**:
  - Read-only security audit passes (`0` Critical/High findings; dangling/managed-dir symlink & YAML quoting fixes verified) + `git status --porcelain` confirms `0` modified files.
- [ ] **Ship (`devops`)**:
  - `.github/workflows/ci.yml` bumped to `actions/checkout@v7` and `actions/setup-node@v7` (matching Dependabot PRs #1 & #2); `README.md` updated; root `PLAN.md` restored to clean blank template; all local CI parity checks green.

## 3. Edge Cases & Risks
- `.cursor/rules/orchestrator.mdc` is the ONLY managed file inside `.cursor/rules/` — `--clean` must never delete user-created `.cursor/rules/*.mdc` files (verified in `sync-tools.test.mjs`).
- `validateWorkspace` must only check `README.md` and `.github/PULL_REQUEST_TEMPLATE.md` when those files exist so minimal unit-test fixtures remain valid.
- Malformed percent-encoding in Markdown links (e.g., `./bad%ZZ.md`) must record a validation error cleanly rather than throwing an uncaught `URIError`.

## 4. Step-by-Step Pipeline Tracker

| # | Stage | Owner | Task Details | Status | Proof |
| :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | Plan | Main Agent | Create `feat/phase-e-real-project-readiness` & write `PLAN.md` | [x] | `PLAN.md` |
| 2 | Design | `web-dev` | Non-UI tooling, security polish & docs | [x] | `N/A (non-UI)` |
| 3 | Build | `web-dev` | 4 TDD slices: `init-template`/`.gitignore`, `sync-tools`, `validate-agents`, refs & `CUSTOMIZING.md` | [ ] | Pending |
| 4 | Verify | `tester` | Run all root & `demo-app` automated test suites (`N/A (non-UI)` browser) | [ ] | Pending |
| 5 | Secure | `security-auditor` | Read-only security audit + Main Agent `git status --porcelain` check | [ ] | Pending |
| 6 | Ship | `devops` | Bump CI actions to `v7`, update `README.md`, reset `PLAN.md`, verify parity | [ ] | Pending |

## 5. Circuit Breaker State
- `web-dev` failures: `0 / 2`
- `tester` failures: `0 / 2`
- `security-auditor` failures: `0 / 2`
- `devops` failures: `0 / 2`
