# PLAN.md — Phase D: Final Polish (Validator Allowlist, Sync Clean/Check, Root DX & Skill References)

> Maintained by the Main Agent during **Step 1 (Plan)** per `AGENTS.md`. (`Step 2 Design` and `Step 4 Browser Screenshots/CWV` are marked `N/A (non-UI)` per Non-UI Task Rules. Root `PLAN.md` will be restored to the clean blank template in Step 6 before merge.)

## 1. Goal & Scope
- **Task**: Deliver the 5 Phase D polish improvements across validator safety, cross-tool sync hygiene, root developer experience (`package.json`, `.nvmrc`, `init-template.mjs`), Progressive Disclosure skill references, and GitHub Actions Dependabot maintenance.
- **User Value**: Catches misspelled/foreign agent tool names and broken Markdown links before runtime, cleans stale mirrored skills on re-sync, gives template users 1-command `npm` scripts and `demo-app/` cleanup, and enriches testing & DB security skills for both Firebase and Postgres/Supabase stacks.
- **Out of Scope**:
  - Modifying `demo-app/` UI or deleting the real `demo-app/` from this template repository.
  - Pushing to `origin` without user confirmation.

## 2. Acceptance Criteria
- [x] **Design**: `N/A (non-UI)` — CLI tooling, validator/sync scripts, skill references, and CI configuration only.
- [ ] **Build (`web-dev`, TDD)**:
  - `scripts/validate-agents.mjs`: enforces `ALLOWED_AGENT_TOOLS` allowlist + validates relative Markdown links inside `.agents/` (ignoring fenced code blocks and external URLs).
  - `scripts/sync-tools.mjs`: maps `read_file -> Read, Glob, Grep` for Claude Code, adds `--clean` (removes stale managed agent/skill files without deleting unrelated config) and `--check` (verifies zero drift on disk).
  - `scripts/init-template.mjs` + `.nvmrc` (`22`) + zero-dependency root `package.json` (`validate`, `test`, `sync`, `sync:dry-run`, `template:init`, `demo:*`).
  - Progressive Disclosure references added and linked in `browser-testing-with-devtools` (`references/devtools-recipes.md`) and `firebase-security-rules-auditor` (`references/db-policy-patterns.md`).
- [ ] **Verify (`tester`, Non-UI)**:
  - All root tests (`validate-agents.test.mjs`, `sync-tools.test.mjs`, `init-template.test.mjs`) and `demo-app` tests (`40` tests), lint, and build pass (`0` failures). Browser screenshots/CWV: `N/A (non-UI)`.
- [ ] **Secure (`security-auditor` + Post-Audit Git Check)**:
  - Read-only security audit passes (`0` Critical/High findings; path-containment verified in `init-template.mjs`, `sync-tools.mjs`, and Markdown link checker) + `git status --porcelain` confirms `0` files modified during audit.
- [ ] **Ship (`devops`)**:
  - `.github/dependabot.yml` added for monthly `github-actions` updates; `.github/workflows/ci.yml` and `README.md` updated; root `PLAN.md` restored to clean blank template; local CI parity green.

## 3. Edge Cases & Risks
- Markdown link checker must ignore `[...]` inside triple-backtick code blocks, anchors (`#section`), and external schemes (`https://`, `mailto:`, `file://`), and reject `..` links escaping repo root.
- `sync-tools.mjs --clean` must only remove files inside managed subdirectories (`.<tool>/agents/` and `.<tool>/skills/`, or `.codex/agents/*.toml`) and never touch user files like `.claude/settings.json` or `.cursor/rules/`.
- `init-template.test.mjs` must run strictly against temporary directories in `os.tmpdir()`, never against the live repo root.

## 4. Step-by-Step Pipeline Tracker

| # | Stage | Owner | Task Details | Status | Proof |
| :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | Plan | Main Agent | Create `feat/phase-d-final-polish` & write `PLAN.md` | [x] | `PLAN.md` |
| 2 | Design | `web-dev` | Non-UI tooling & documentation task | [x] | `N/A (non-UI)` |
| 3 | Build | `web-dev` | Validator allowlist/links, sync `--clean`/`--check`, root DX, 2 skill refs | [ ] | Pending |
| 4 | Verify | `tester` | Run all root & `demo-app` automated test suites (`N/A (non-UI)` browser) | [ ] | Pending |
| 5 | Secure | `security-auditor` | Read-only security audit + Main Agent `git status --porcelain` check | [ ] | Pending |
| 6 | Ship | `devops` | Add `dependabot.yml`, update `ci.yml` & `README.md`, reset `PLAN.md` | [ ] | Pending |

## 5. Circuit Breaker State
- `web-dev` failures: `0 / 2`
- `tester` failures: `0 / 2`
- `security-auditor` failures: `0 / 2`
- `devops` failures: `0 / 2`
