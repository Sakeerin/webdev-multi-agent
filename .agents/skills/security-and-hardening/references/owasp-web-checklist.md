# OWASP Web Security & Hardening Reference Checklist

Use this detailed checklist during **Step 5 (Secure)** alongside [SKILL.md](../SKILL.md).

---

## 1. Authentication, Sessions & Access Control (IDOR / Privilege Escalation)
- [ ] Every protected route, API handler, and server action enforces authentication on the server before reading or mutating data.
- [ ] Resource ownership (`resource.ownerId === session.userId`) or explicit RBAC role checks are verified on every read, update, and delete (no client-only authorization gates).
- [ ] Session cookies enforce `HttpOnly`, `Secure` (HTTPS), `SameSite=Lax` or `Strict`, and bounded expiration / rotation on privilege changes.
- [ ] Password resets, OAuth callbacks, and magic links use single-use, short-lived, cryptographically random tokens (`crypto.randomBytes` / Web Crypto).

## 2. Injection, XSS & Request Validation
- [ ] All untrusted request payloads (params, query, body, headers, localStorage/JSON) are validated against strict allowlist schemas (type, length, enum, format).
- [ ] Untrusted strings rendered into the DOM use safe text APIs (`textContent`, `createTextNode`, framework auto-escaping) — never `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, or unsanitized `dangerouslySetInnerHTML`.
- [ ] Dynamic URLs (`href`, `src`, redirects) validate protocol allowlists (`https:`, `http:` or relative paths), blocking `javascript:`, `data:text/html`, and open redirects.
- [ ] SQL / NoSQL queries use parameterized bindings or strict query builders (zero string concatenation); shell commands avoid `shell: true` and interpolate-free argument arrays (`spawnSync(bin, args)`).

## 3. CSRF, HTTP Headers, CSP & Server Hardening
- [ ] State-changing cookie-authenticated endpoints enforce CSRF protection (`SameSite` cookies + Origin/Referer validation or CSRF tokens).
- [ ] Strict `Content-Security-Policy` avoids `'unsafe-inline'` / `'unsafe-eval'`, locks `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, and sets `form-action 'self'`.
- [ ] Baseline security headers set: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (or `strict-origin-when-cross-origin`), `Permissions-Policy`.
- [ ] Static file servers enforce normalized + `realpathSync` containment checks, reject null bytes, backslashes, drive prefixes, and directory listings, and do not expose permissive wildcard CORS (`*`) on credentialed routes.

## 4. Deserialization, Prototype Pollution & Error Handling
- [ ] `JSON.parse()` of untrusted/stored data is wrapped in `try/catch`, validated by schema, and reconstructed with explicit key allowlists (rejecting/stripping `__proto__`, `constructor`, `prototype`).
- [ ] Error responses and UI alerts return safe user-facing messages without leaking stack traces, internal file paths, SQL queries, or tokens.

## 5. Secrets Hygiene & Software Supply Chain
- [ ] Zero hardcoded API keys, tokens, private keys, or `.env` files in tracked files or git history; `.gitignore` covers `.env*` (except `.env.example`), `*.pem`, `*.key`, and `*serviceAccount*.json`.
- [ ] Server-only credentials are never exposed via client bundle prefixes (`NEXT_PUBLIC_`, `VITE_`) or client logs.
- [ ] Dependencies use lockfiles (`package-lock.json` / `pnpm-lock.yaml`), package audit shows `0` `Critical` / `High` vulnerabilities, and CI pins/restricts workflow `permissions:`.
