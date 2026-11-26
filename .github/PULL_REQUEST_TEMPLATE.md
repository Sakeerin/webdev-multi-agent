## Summary
<!-- Concise description of what changed and why. -->

- **Plan (`Step 1`)**: [PLAN.md](../PLAN.md)
- **Design Spec (`Step 2`)**: <!-- Link to DESIGN_SPEC / Stitch screen, or mark N/A (non-UI) -->

---

## Multi-Agent Pipeline Proof Checklist (per `AGENTS.md`)

### Step 2 — Design (`web-dev`)
- [ ] `375px` mobile-first layout spec / responsive breakpoints verified (or marked `N/A (non-UI)`)

### Step 3 — Build (`web-dev`)
- [ ] Incremental, focused commits with tests first
- [ ] Local `lint`, `test`, and `build` passing

### Step 4 — Verify (`tester`)
- [ ] Automated test suite passing (`0` failures)
- [ ] Mobile (`375x812`) and Desktop (`1280x800`) screenshots captured & inspected (or `N/A (non-UI)`)
- [ ] Mobile Core Web Vitals within target (`LCP <= 2.5s`, `INP <= 200ms`, `CLS <= 0.1`)
- [ ] Zero console errors and zero unexpected `4xx`/`5xx` network requests

### Step 5 — Secure (`security-auditor`)
- [ ] Security audit status: `PASS` (`0` Critical / High findings)
- [ ] Input validation, secrets hygiene, headers, and DB/Firebase rules verified

### Step 6 — Ship (`devops`)
- [ ] CI quality gates passing (never bypass branch protections)
- [ ] Environment variables documented in `.env.example` (no secrets committed)

---

## Rollback Plan
<!-- Explain how to revert safely if an issue is detected after merge. -->
Revert the merge commit on `main` (`git revert -m 1 <merge-sha>`) and allow CI gates to verify before re-deploying the previous artifact.
