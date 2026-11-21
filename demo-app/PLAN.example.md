# PLAN.example.md — Example Completed Plan: "Sprint Pulse" (`demo-app/`)

> Reference example of a completed `PLAN.md` from the **Sprint Pulse** End-to-End Dry Run & Phase A hardening (`AGENTS.md` 6-step pipeline). Copy this structure into root `PLAN.md` when starting a new feature.

## 1. Goal & Scope
- **Task**: Design, build, verify, audit, and prepare to ship a zero-dependency, `375px` mobile-first sprint task tracker (**Sprint Pulse**) inside `demo-app/`.
- **User Value**: Demonstrates the end-to-end deterministic Multi-Agent Web Developer pipeline (`Plan -> Design -> Build -> Verify -> Secure -> Ship`) with real-browser verification and automated CI gates.
- **Out of Scope**:
  - Live Firebase cloud deployment (includes least-privilege `demo-app/firestore.rules` as a reference rules artifact).

## 2. Acceptance Criteria
- [x] **Design (`375px` mobile-first)**: Layout spec in `demo-app/DESIGN_SPEC.md` defining CSS tokens, typography, spacing, WCAG AA contrast, `>= 44x44px` touch targets, responsive breakpoints (`375px -> 768px -> 1024px`), and loading/empty/error states.
- [x] **Build (Incremental + TDD)**:
  - Domain model (`taskModel.js`) and schema-validated persistence (`storage.js`) built tests-first (`node:test`).
  - Create, filter (`All`, `Active`, `Done`), search, toggle complete, advance stage (`Plan -> Design -> Build -> Verify -> Secure -> Ship`), delete, progress bar, and corrupted `localStorage` recovery.
  - Strict validation (`1..80` char title, `<= 128` char ID) and XSS-safe DOM rendering (zero `innerHTML`).
  - `npm run lint`, `npm test`, and `npm run build` all pass.
- [x] **Verify (Real Browser + Core Web Vitals)**:
  - Automated tests pass (`40` tests across `8` suites including `tests/serve.test.js` added in Phase A).
  - Live browser check via `chrome-devtools-mcp` at mobile (`375x812`) and desktop (`1280x800`) viewports with screenshots.
  - Mobile Core Web Vitals verified: `LCP 123ms` (`<= 2.5s`), `INP 21ms` (`<= 200ms`), `CLS 0.00` (`<= 0.1`), `0` console/network errors.
- [x] **Secure (Audit + Rules)**:
  - Code, CSP/HTTP security headers (`serve.mjs`), secrets hygiene, dependencies (`0` external), and `demo-app/firestore.rules` audited (`0` Critical/High/Medium findings).
- [x] **Ship (CI & Release Readiness)**:
  - GitHub Actions CI workflow (`.github/workflows/ci.yml`) configured and verified green.

## 3. Edge Cases & Risks
- Empty/whitespace-only or `> 80`-char title -> inline accessible error, no task created.
- HTML/script payload (`<img src=x onerror=alert(1)>`) -> rendered strictly as plain text.
- Malformed JSON in `localStorage` -> safe recovery to `[]` with dismissible recovery banner.
- Long unbroken titles at `375px` -> wrapped cleanly with `0px` horizontal overflow.

## 4. Step-by-Step Pipeline Tracker

| # | Stage | Owner | Task Details | Status | Proof |
| :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | Plan | Main Agent | Scope, acceptance criteria & edge cases | [x] | `PLAN.md` (`2f16a9f`) |
| 2 | Design | `web-dev` | `375px` mobile-first spec in `demo-app/DESIGN_SPEC.md` | [x] | `demo-app/DESIGN_SPEC.md` (`47d4319`) |
| 3 | Build | `web-dev` | Incremental slices + tests first in `demo-app/` | [x] | `35106bd`..`e2326e5` + Phase A `40` tests |
| 4 | Verify | `tester` | `chrome-devtools-mcp` mobile/desktop + CWV | [x] | `PASS`: `LCP 123ms`, `INP 21ms`, `CLS 0.00`, `0` console/net errs |
| 5 | Secure | `security-auditor` | App, CSP headers, deps, and `firestore.rules` | [x] | `PASS`: `0` Critical/High/Medium findings, `firestore.rules` PASS |
| 6 | Ship | `devops` | CI quality gates + PR readiness | [x] | `READY`: `.github/workflows/ci.yml` (`f7e273d`) |

## 5. Circuit Breaker State
- `web-dev` failures: `0 / 2`
- `tester` failures: `0 / 2`
- `security-auditor` failures: `0 / 2`
- `devops` failures: `0 / 2`
