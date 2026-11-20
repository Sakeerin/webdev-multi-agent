# PLAN.md — Phase 4 End-to-End Dry Run: "Sprint Pulse" Web App

> Maintained by the Main Agent during **Step 1 (Plan)** per `AGENTS.md`.

## 1. Goal & Scope
- **Task**: Execute a complete 6-step End-to-End Dry Run of the Multi-Agent Web Developer pipeline by designing, building, verifying, auditing, and preparing to ship a self-contained mini web app (**Sprint Pulse**) inside `demo-app/`.
- **User Value**: Validates that all 4 sub-agents (`web-dev`, `tester`, `security-auditor`, `devops`), all 9 skills, proof-driven handoffs, and MCP integrations (`chrome-devtools-mcp`) work smoothly together on a real web project.
- **Out of Scope**:
  - Live cloud backend / Firebase deployment (we include `demo-app/firestore.rules` as a realistic security rules artifact for `security-auditor`, and keep the app runnable 100% locally with zero external dependencies).
  - Pushing to a remote GitHub repository or deploying to production (dry-run stops at PR-ready local branch + CI workflow verification unless user requests push/deploy).

## 2. Acceptance Criteria
- [x] **Design (`375px` mobile-first)**: Clean layout spec in `demo-app/DESIGN_SPEC.md` defining tokens, typography, spacing, WCAG AA contrast, `>= 44x44px` touch targets, responsive breakpoints (`375px` -> `768px` -> `1024px`), and loading/empty/error states.
- [x] **Build (Incremental + TDD)**:
  - Pure domain logic (`taskModel.js`) and safe persistence (`storage.js`) implemented with **tests first** using `node:test`.
  - Features: create task (title, stage, priority), filter by status (`All`, `Active`, `Done`), search, toggle done, advance pipeline stage (`Plan -> Design -> Build -> Verify -> Secure -> Ship`), delete task, progress indicator, and `localStorage` persistence with corrupted-data recovery.
  - Strict input validation (trimmed non-empty title, max 80 chars, valid stage/priority enums) and XSS-safe DOM rendering (no unsafe `innerHTML`).
  - Reference least-privilege `demo-app/firestore.rules` matching the task schema.
  - Small, focused git commits on branch `feat/dry-run-sprint-tracker`; `npm run lint`, `npm test`, and `npm run build` all pass.
- [x] **Verify (Real Browser + Core Web Vitals)**:
  - All automated tests pass (`node --test`).
  - Verified live in Chrome via `chrome-devtools-mcp` at **mobile (`375x812`)** and **desktop (`1280x800`)** viewports.
  - Screenshots captured for mobile and desktop; interactive flows tested (add, advance stage, filter, toggle done, delete).
  - Mobile Core Web Vitals recorded: `LCP <= 2.5s`, `INP <= 200ms`, `CLS <= 0.1`.
  - Zero uncaught console errors and zero failed network requests (`4xx`/`5xx`).
- [x] **Secure (Audit + Rules)**:
  - Full audit of XSS/injection, validation, secrets, HTTP security headers (in `serve.mjs`), dependencies, and `demo-app/firestore.rules`.
  - Structured Security Audit report with `PASS` status (zero Critical/High issues).
- [x] **Ship (CI & Release Readiness)**:
  - GitHub Actions CI workflow (`.github/workflows/ci.yml`) configured and locally verified for lint, test, build, and security checks.
  - Pre-launch checklist completed and PR summary prepared on `feat/dry-run-sprint-tracker` (no unauthorized push/merge).

## 3. Edge Cases to Handle
- Submitting empty/whitespace-only title or > 80 characters -> inline accessible error message, no task created.
- Submitting HTML/script payloads (e.g., `<img src=x onerror=alert(1)>`) -> rendered strictly as plain text.
- Corrupted or unexpected JSON in `localStorage` -> graceful fallback to empty list with non-blocking error banner.
- Very long unbroken task titles at `375px` -> clean text wrapping with zero horizontal overflow.
- Empty filter/search results -> clear empty state message with quick reset action.

## 4. Step-by-Step Pipeline Tracker

| # | Stage | Owner | Task Details | Status | Proof |
| :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | Plan | Main Agent | Initialize git repo & write `PLAN.md` | [x] | `PLAN.md` |
| 2 | Design | `web-dev` | Create `375px` mobile-first spec in `demo-app/DESIGN_SPEC.md` | [x] | `demo-app/DESIGN_SPEC.md` (`47d4319`) |
| 3 | Build | `web-dev` | Build `demo-app/` incrementally with tests first & small commits | [x] | 5 commits (`35106bd`..`e2326e5`), lint/25 tests/build PASS |
| 4 | Verify | `tester` | Run tests + `chrome-devtools-mcp` mobile/desktop checks & CWV | [x] | PASS: 25/25 tests, LCP 123ms / INP 21ms / CLS 0.00, 0 console/net errs, 375px & 1280px screenshots |
| 5 | Secure | `security-auditor` | Audit app code, server headers, deps, and `firestore.rules` | [x] | PASS: 0 Critical/High/Medium, 4 Low notes, Firestore rules PASS |
| 6 | Ship | `devops` | Add CI workflow, verify parity checks, prepare PR summary | [x] | READY: `.github/workflows/ci.yml` (`f7e273d`), 4/4 CI parity gates PASS, PR ready |

## 5. Circuit Breaker State
- `web-dev` failures: `0 / 2`
- `tester` failures: `0 / 2`
- `security-auditor` failures: `0 / 2`
- `devops` failures: `0 / 2`
