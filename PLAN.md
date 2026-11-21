# PLAN.md — Phase A: Bug Fixes, Server Regression Tests, Security Hardening & Repo Hygiene

> Maintained by the Main Agent during **Step 1 (Plan)** per `AGENTS.md`.

## 1. Goal & Scope
- **Task**: Address Phase A findings from the project review on branch `fix/phase-a-bugs-hardening-hygiene`: fix real bugs in `demo-app/`, add regression tests for `serve.mjs`, apply security hardening (`CSP`, `firestore.rules`, `.gitignore`), and add open-source repo hygiene files (`LICENSE`, `.gitattributes`, `.editorconfig`, `.github/PULL_REQUEST_TEMPLATE.md`).
- **User Value**: Eliminates silent task-loss and copy bugs in `demo-app/`, protects the static server with permanent regression tests, tightens Firestore & CSP boundaries, and prepares `webdev-multi-agent` for clean public template usage.
- **Out of Scope**:
  - Resetting `PLAN.md` to a blank template / moving dry-run plans (Phase B).
  - Adding `.agents/` schema validation scripts to CI (Phase B).
  - Cross-tool sync scripts or `AGENTS.md` non-UI workflow updates (Phase C).
  - Merging to `main` or pushing to `origin` without user authorization.

## 2. Acceptance Criteria
- [x] **Design (`N/A — bugfix, test coverage, security hardening, and repo hygiene only; preserves demo-app/DESIGN_SPEC.md`)**.
- [x] **Bug Fixes (`demo-app/`) via TDD**:
  - `taskModel.js` exports `MAX_ID_LENGTH = 128` and enforces it in both `createTask()` and `isValidTask()`.
  - `taskModel.js` exports `formatEmptyStateCopy({ totalTasks, filter, query })` and fixes `"No all tasks match ..."` when `filter === 'All'` (`No tasks match "..."` / `There are currently no tasks.`).
  - `app.js` uses `formatEmptyStateCopy()`, exports `init`, and guards DOM lookups so importing `app.js` in Node / non-DOM environments never throws.
- [x] **Server & Linter Hardening + Regression Tests**:
  - `scripts/lint.mjs` catches unquoted inline `on*=` attributes inside HTML tags and strips CSS strings before counting `{`/`}` brace balance.
  - `scripts/serve.mjs` CSP includes `form-action 'self'; connect-src 'none'` and `resolveSafePath()` explicitly returns `403` for Windows drive-letter prefixes (`/C:/...`, `/d:...`), while preserving raw `/%2e%2e/` traversal path before URL dot-segment collapse.
  - `tests/serve.test.js` covers `SECURITY_HEADERS`, `resolveSafePath()` traversal/encoding/drive/null-byte/directory/symlink vectors, and `createStaticServer()` HTTP endpoints (`GET`, `HEAD`, `POST 405`, `403`, `404`).
- [x] **Security Hardening & Repo Hygiene**:
  - `demo-app/firestore.rules` splits `allow read` into `allow get` and bounded `allow list` (`request.query.limit != null && request.query.limit <= 100`).
  - `.gitignore` ignores `*.pem`, `*.key`, and `*serviceAccount*.json`.
  - Root `LICENSE` (MIT), `.gitattributes`, `.editorconfig`, and `.github/PULL_REQUEST_TEMPLATE.md` added.
- [x] **CI Parity Checks**:
  - Secret check (`git ls-files` for `.env*` excluding `.env.example`), `demo-app/dist` untracked check, `npm run lint`, `npm test`, `npm run build`, and `node -e` import check on `app.js` all pass with exit code `0`.

## 3. Step-by-Step Pipeline Tracker

| # | Stage | Owner | Task Details | Status | Proof |
| :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | Plan | Main Agent | Create `fix/phase-a-bugs-hardening-hygiene` & update `PLAN.md` | [x] | `PLAN.md` (`bb36dcc`) |
| 2 | Design | `web-dev` | Preserves `demo-app/DESIGN_SPEC.md` (no UI layout changes) | [x] | `N/A (non-UI / bugfix & hardening)` |
| 3 | Build | Main Agent (Exec) | Fix bugs via TDD, add `tests/serve.test.js`, apply hardening & repo hygiene | [x] | 4 commits (`bc14bcb`, `29e86ac`, `79680f5`, `10650a4`) |
| 4 | Verify | Main Agent (Exec) | Run `npm run lint`, `npm test`, `npm run build`, and `app.js` Node import check | [x] | PASS: lint (`9 JS/MJS, 1 HTML, 1 CSS`), tests (`39/40 pass, 0 fail, 1 Windows symlink skip`), build PASS, `app.js` import `function false` |
| 5 | Secure | Main Agent (Exec) | Verify CSP, Firestore bounded `list`, `.gitignore`, and secret check | [x] | PASS: CSP `form-action`/`connect-src`, bounded `list <= 100`, 0 tracked `.env`/dist files |
| 6 | Ship | Main Agent (Exec) | Verify clean git status, PR template ready, await user approval to merge/push | [x] | Clean branch `fix/phase-a-bugs-hardening-hygiene` ready for merge/push approval |

## 4. Circuit Breaker State
- `Main Agent (Exec)` failures: `0 / 2`
