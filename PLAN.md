# PLAN.md — Task Execution Plan

> Maintained by the Main Agent during **Step 1 (Plan)** per `AGENTS.md` before delegating to sub-agents. (See `demo-app/PLAN.example.md` for a completed reference example.)

## 1. Goal & Scope
- **Task**: `<Short description of the feature, bugfix, or refactor>`
- **User Value**: `<Why this matters to the user>`
- **Out of Scope**: `<What we will explicitly NOT change in this task>`

## 2. Acceptance Criteria
- [ ] **Design (`375px` mobile-first)**: Component/layout spec or Stitch HTML reference with responsive breakpoints (`N/A (non-UI)` only for non-UI tasks).
- [ ] **Build (Incremental + TDD)**: Small, focused commits with tests written/updated first; `lint`, `typecheck`, `test`, and `build` pass.
- [ ] **Verify (Automated + Browser)**: Automated tests pass; mobile (`375px`) and desktop screenshots inspected; mobile `LCP <= 2.5s`, `INP <= 200ms`, `CLS <= 0.1`; zero console/network errors.
- [ ] **Secure (Audit + Rules)**: `security-auditor` reports `PASS` with `0` Critical/High findings across auth, validation, secrets, dependencies, and DB/Firebase rules.
- [ ] **Ship (CI & Release)**: Pre-launch checklist complete, `.github/workflows/ci.yml` gates green, and PR ready.

## 3. Edge Cases & Risks
- `<List boundary conditions, invalid inputs, failure modes, and assumptions>`

## 4. Step-by-Step Pipeline Tracker

| # | Stage | Owner | Task Details | Status | Proof |
| :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | Plan | Main Agent | Define scope, acceptance criteria & edge cases | [ ] | `PLAN.md` |
| 2 | Design | `web-dev` | `375px` mobile-first UI spec (or `N/A (non-UI)`) | [ ] | Pending |
| 3 | Build | `web-dev` | Incremental vertical slices + tests first | [ ] | Pending |
| 4 | Verify | `tester` | Automated tests + DevTools mobile/desktop & CWV | [ ] | Pending |
| 5 | Secure | `security-auditor` | Auth, input validation, secrets, deps & rules audit | [ ] | Pending |
| 6 | Ship | `devops` | CI gates, pre-launch checklist & PR preparation | [ ] | Pending |

## 5. Circuit Breaker State
- `web-dev` failures: `0 / 2`
- `tester` failures: `0 / 2`
- `security-auditor` failures: `0 / 2`
- `devops` failures: `0 / 2`
