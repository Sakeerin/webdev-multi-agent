---
name: security-and-hardening
description: >-
  Use this skill when auditing web application security: authentication,
  authorization, input validation, XSS/CSRF/injection risks, secrets exposure,
  HTTP security headers, and dependency vulnerabilities.
---

# Security and Hardening Audit

Systematically review web application code, configuration, and dependencies before shipping.

## Steps

1. **Authentication & Authorization**
   - Verify every protected route, server action, and API endpoint enforces authentication and ownership/role checks on the server (never trust client-side checks alone).
   - Check session/cookie flags (`HttpOnly`, `Secure`, `SameSite`) and token expiration handling.
2. **Input Validation & Injection Prevention**
   - Confirm all user inputs are validated against strict schemas (e.g., Zod/Valibot) on the server boundary.
   - Check for XSS vectors (`dangerouslySetInnerHTML`, unsanitized `innerHTML`, `javascript:` URLs), SQL/NoSQL injection, and open redirects.
3. **Secrets & Data Exposure**
   - Scan tracked files for hardcoded API keys, tokens, private keys, or committed `.env` files.
   - Verify server-only secrets are not leaked into client bundles (e.g., wrong `NEXT_PUBLIC_` / `VITE_` prefixes) or error stack traces.
4. **Dependencies & Security Headers**
   - Run package vulnerability audit (e.g., `npm audit`, `pnpm audit`) and flag any `Critical` or `High` issues.
   - Review CORS policy, CSP, `X-Content-Type-Options`, and `Referrer-Policy` headers.

## Validation Checklist
- [ ] Every finding is categorized (`Critical`, `High`, `Medium`, `Low`) with exact `file:line` and remediation.
- [ ] Zero `Critical` or `High` vulnerabilities remain for a `PASS` verdict.
- [ ] Dependency audit output is attached to the report.
