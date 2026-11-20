---
name: incremental-implementation
description: >-
  Use this skill when implementing features or refactors in small, vertical
  slices with atomic commits, keeping tests, lint, and builds green at every
  step instead of writing large monolithic diffs.
---

# Incremental Implementation

Deliver working software in small, verifiable slices so defects are isolated early and reviews stay fast.

## Steps

1. **Slice the Plan Vertically**
   - Read `PLAN.md` and break the feature into small, independent slices (e.g., data contract -> core logic -> UI component -> integration).
   - Each slice should be small enough to verify in minutes.
2. **Tests First, Then Minimal Code**
   - Add or update a failing test describing the slice's behavior before writing implementation code.
   - Write the simplest clean implementation that makes the test pass.
3. **Verify Every Slice Locally**
   - Run targeted tests, linter, and type-checker after completing each slice.
   - Never stack a new slice on top of a broken build or failing test.
4. **Commit Cleanly (When Git Is Initialized)**
   - Stage only files belonging to the current slice.
   - Use clear, scoped commit messages (e.g., `feat(cart): add quantity validation and unit tests`).

## Validation Checklist
- [ ] Each slice has corresponding test coverage.
- [ ] Diff is minimal, readable, and free of unrelated formatting churn or debug logs.
- [ ] Lint, type-check, unit tests, and build all pass before handoff.
