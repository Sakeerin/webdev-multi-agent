---
name: tdd
description: >-
  Use this skill when writing or verifying automated tests using Test-Driven
  Development (Red-Green-Refactor), ensuring behavior-focused assertions,
  edge-case coverage, and deterministic test execution.
---

# Test-Driven Development (TDD)

Drive implementation and verification through fast, reliable, behavior-focused tests.

## Steps

1. **Red — Write a Failing Test First**
   - Translate acceptance criteria from `PLAN.md` into concrete test cases covering the happy path, boundary conditions, and error paths.
   - Run the test suite and confirm the new test fails for the expected reason.
2. **Green — Confirm Minimal Passing Implementation**
   - Verify the implementation satisfies all assertions without hardcoding test-specific shortcuts.
   - Test user-observable behavior (rendered DOM, return values, emitted events) rather than fragile internal implementation details.
3. **Refactor — Keep Tests Clean & Deterministic**
   - Eliminate flakiness: mock unstable clocks/network calls at boundaries, avoid arbitrary `sleep` timers, and isolate test state between runs.
   - Keep test names descriptive (`should <expected behavior> when <condition>`).

## Validation Checklist
- [ ] Full automated test suite executes and passes (`exit code 0`).
- [ ] Happy path, edge cases, and error handling are all covered.
- [ ] Tests are deterministic and leave no side effects in the workspace.
