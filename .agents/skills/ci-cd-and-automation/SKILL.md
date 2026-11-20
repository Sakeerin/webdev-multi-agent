---
name: ci-cd-and-automation
description: >-
  Use this skill when setting up, reviewing, or verifying CI/CD pipelines,
  automated quality gates (lint, type-check, test, build, security audit), and
  branch/PR automation workflows.
---

# CI/CD and Automation

Ensure automated quality gates protect the main branch so CI objectively decides merge readiness.

## Steps

1. **Inspect Existing CI Workflows**
   - Check `.github/workflows/` (or the repo's CI config) to verify automated jobs exist for:
     - Install dependencies with frozen lockfile
     - Lint & Type-check
     - Automated tests
     - Production build
     - Dependency/security audit
2. **Validate Pipeline Hygiene**
   - Confirm workflows pin action versions, use dependency caching, and fail fast on errors.
   - Ensure no secrets are echoed in logs and least-privilege `permissions:` are configured in GitHub Actions.
3. **Run Local Parity Check**
   - Execute the exact same lint, test, and build commands locally before opening or updating a PR so CI failures are caught early.

## Validation Checklist
- [ ] All CI quality gate commands pass locally with zero errors.
- [ ] CI workflow definitions are valid, minimal, and secure.
- [ ] No unignored temporary or build artifacts are staged for commit.
