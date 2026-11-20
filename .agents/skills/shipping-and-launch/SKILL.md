---
name: shipping-and-launch
description: >-
  Use this skill when preparing a Pull Request, running pre-launch checklists,
  verifying environment configuration, or deploying a web application to
  Firebase App Hosting, Cloud Run, Vercel, or Netlify.
---

# Shipping and Launch

Ship verified, audited changes safely with a clean PR, green CI gates, and a rollback path.

## Steps

1. **Verify Prior Pipeline Proofs**
   - Confirm `PLAN.md` acceptance criteria are checked off.
   - Confirm `tester` reported `PASS` (tests + screenshots + mobile Core Web Vitals).
   - Confirm `security-auditor` reported `PASS` (zero Critical/High findings).
2. **Run Pre-Launch Checklist**
   - Verify required environment variables are documented in `.env.example` (never commit real secrets).
   - Verify production build succeeds cleanly and target config (`firebase.json`, `apphosting.yaml`, `Dockerfile`, `vercel.json`, or `netlify.toml`) is valid.
3. **Open the Pull Request (CI Decides)**
   - Summarize changes, link `PLAN.md`, attach verification proof and security status in the PR body.
   - Do **not** merge or bypass failing CI checks.
4. **Deploy & Smoke-Test (Only When Authorized)**
   - Trigger preview or production deployment only when requested by the user.
   - Verify the deployed URL responds with `HTTP 200`, renders cleanly, and has a clear rollback procedure.

## Validation Checklist
- [ ] All prior step proofs (`Plan`, `Verify`, `Secure`) confirmed present.
- [ ] PR description is complete and CI status is reported.
- [ ] Deployment URL and smoke-test result recorded (if deployed).
