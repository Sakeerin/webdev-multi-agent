---
name: firebase-security-rules-auditor
description: >-
  Use this skill when auditing Firebase Security Rules (Firestore, Realtime
  Database, Cloud Storage) or equivalent database access policies to enforce
  least privilege, prevent wildcard access, and validate schema integrity.
---

# Firebase Security Rules Auditor

Audit Firebase Security Rules (and equivalent DB/RLS policies if another backend is used) to guarantee least-privilege data access.

## Steps

1. **Locate Rule Files**
   - Inspect `firestore.rules`, `database.rules.json`, `storage.rules`, and `firebase.json` (or note N/A if Firebase is not used, and audit the project's equivalent DB/RLS policies instead).
2. **Check for Dangerous Patterns**
   - Flag any open wildcard rules (`allow read, write: if true;` or expired/broad timestamp allowlists).
   - Verify default-deny fallback at the root (`match /{document=**} { allow read, write: if false; }`).
3. **Verify Authentication, Ownership & Schema Validation**
   - Confirm `request.auth != null` is checked for all private collections.
   - Verify document ownership (`request.auth.uid == resource.data.userId`) and prevent users from modifying immutable fields (`role`, `ownerId`, `createdAt`) on update.
   - Check `request.resource.data` type, size, and allowed field validation on `create`/`update`.
   - For Storage rules, verify file size limits and `contentType` restrictions.
4. **Verify Rules Tests (If Available)**
   - Check whether Firebase Emulator rules unit tests exist and pass.

## Validation Checklist
- [ ] Default-deny rule confirmed; zero open `if true` write rules.
- [ ] Auth, ownership, field immutability, and payload validation checked.
- [ ] Clear `PASS` / `FAIL` / `N/A (non-Firebase project audited via equivalent policies)` verdict reported.

See [references/db-policy-patterns.md](./references/db-policy-patterns.md) for Firestore and PostgreSQL/Supabase RLS patterns.
