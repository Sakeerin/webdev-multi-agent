# Customizing `webdev-multi-agent` for Your Project

This guide walks through turning this template repository into a production web application while keeping the deterministic 6-step pipeline (`Plan -> Design -> Build -> Verify -> Secure -> Ship`) in [AGENTS.md](./AGENTS.md) intact.

---

## 1. Initialize a Clean Workspace (`npm run template:init`)

When you clone or click **Use this template** on GitHub, the repository includes the reference `demo-app/` (**Sprint Pulse**). Once you are ready to scaffold your own application:

```bash
# 1. Preview what will be cleaned (no files modified)
npm run template:init:dry-run

# 2. Remove demo-app/, strip demo:* scripts from package.json, reset PLAN.md, and validate .agents/
npm run template:init
```

What [scripts/init-template.mjs](./scripts/init-template.mjs) does automatically:
- Deletes `demo-app/` (rejecting symbolic links for safety).
- Strips `demo:lint`, `demo:test`, and `demo:build` from root [package.json](./package.json) while preserving `validate`, `test`, `sync`, and `template:init` so re-runs stay idempotent.
- Resets [PLAN.md](./PLAN.md) to the blank 6-step execution template.
- Re-runs [scripts/validate-agents.mjs](./scripts/validate-agents.mjs) to confirm your playbook is clean.
- `.github/workflows/ci.yml` automatically skips the `demo-app-quality` job once `demo-app/package.json` is absent.

---

## 2. Adapt Skills & CI Gates to Your Stack

Keep [AGENTS.md](./AGENTS.md) concise (`<= 24,000` bytes) and put framework- or database-specific guidance inside `.agents/skills/`:

| Stack Layer | Files to Tailor | Recommended Adjustments |
| :--- | :--- | :--- |
| **Next.js / Vite / Astro / SvelteKit** | [.agents/skills/frontend-ui-engineering/SKILL.md](./.agents/skills/frontend-ui-engineering/SKILL.md) & [responsive-and-a11y-checklist.md](./.agents/skills/frontend-ui-engineering/references/responsive-and-a11y-checklist.md) | Add your design system token paths (`tailwind.config.*` or CSS variables), App Router / Server Action conventions, and `lint` / `typecheck` / `build` scripts in `package.json`. |
| **Vitest / Playwright** | [.agents/skills/tdd/SKILL.md](./.agents/skills/tdd/SKILL.md) & [.agents/skills/browser-testing-with-devtools/SKILL.md](./.agents/skills/browser-testing-with-devtools/SKILL.md) | Update the local dev server port in DevTools verification recipes (default `http://localhost:3000` or `http://localhost:5173`) and wire your test runner into `.github/workflows/ci.yml`. |
| **Supabase / PostgreSQL / Prisma** | [.agents/skills/firebase-security-rules-auditor/SKILL.md](./.agents/skills/firebase-security-rules-auditor/SKILL.md) & [db-policy-patterns.md](./.agents/skills/firebase-security-rules-auditor/references/db-policy-patterns.md) | Point `security-auditor` to `supabase/migrations/*.sql` or `prisma/schema.prisma` to enforce Row-Level Security (`ENABLE ROW LEVEL SECURITY`) and ownership policies on every table. |
| **Firebase / Vercel / Netlify / Cloud Run** | [.agents/skills/shipping-and-launch/SKILL.md](./.agents/skills/shipping-and-launch/SKILL.md) & [hosting-configs.md](./.agents/skills/shipping-and-launch/references/hosting-configs.md) | Copy the matching `firebase.json`, `apphosting.yaml`, `vercel.json`, `netlify.toml`, or Cloud Run `Dockerfile` template and tune `Content-Security-Policy` origins. |

---

## 3. Add a New Sub-Agent Safely

Every sub-agent in `.agents/agents/<name>.md` is validated by [scripts/validate-agents.mjs](./scripts/validate-agents.mjs):

1. **Create `.agents/agents/<name>.md`** where frontmatter `name` matches the filename stem (`<name>`):
   ```yaml
   ---
   name: api-architect
   description: >-
     Backend API specialist responsible for OpenAPI/schema contracts and database migrations.
   skills:
     - tdd
     - incremental-implementation
   tools:
     - read_file
     - write_file
     - edit_file
     - run_command
   ---
   ```
2. **Respect `ALLOWED_AGENT_TOOLS`**:
   - Only declare tools from `ALLOWED_AGENT_TOOLS`: `read_file`, `write_file`, `edit_file`, `run_command`, `search_web`.
   - Do **not** list auto-injected runtime/MCP tools (`call_mcp_tool`, `list_resources`, `read_resource`, `send_message`, `manage_task`) in `tools:` — Antigravity injects those automatically, and listing them causes startup errors.
   - Keep `security-auditor` strictly read-only (`read_file`, `run_command` — never `write_file` or `edit_file`).
3. **Register the Sub-Agent in [AGENTS.md](./AGENTS.md)**:
   - Add the new sub-agent to the **Sub-Agent Roster** table in [AGENTS.md](./AGENTS.md) (unreferenced sub-agents fail validation).

---

## 4. Validate & Sync Across AI Coding Tools

Whenever you edit [AGENTS.md](./AGENTS.md), `.agents/agents/*.md`, or `.agents/skills/**`:

```bash
# 1. Validate frontmatter, tool allowlists, byte budgets, and relative Markdown links
npm run validate

# 2. Run unit tests for validator, cross-tool sync, and template initializer
npm test

# 3. Preview cross-tool output without writing files
npm run sync:dry-run

# 4. Sync to your team's tools (claude | cursor | gemini | codex | all) and prune retired files
node scripts/sync-tools.mjs --target=all --clean

# 5. Verify zero drift in CI or pre-commit hooks
npm run sync:check
```

What [scripts/sync-tools.mjs](./scripts/sync-tools.mjs) generates per target:
- **Claude Code (`--target=claude`)**: `.claude/agents/*.md` (mapping least-privilege tools such as `read_file -> Read, Glob, Grep`) and `.claude/skills/**`, paired with root [CLAUDE.md](./CLAUDE.md).
- **Cursor (`--target=cursor`)**: `.cursor/rules/orchestrator.mdc` (`alwaysApply: true`, preserving any custom `.cursor/rules/*.mdc` files on `--clean`), `.cursor/agents/*.md`, and `.cursor/skills/**`.
- **Gemini CLI (`--target=gemini`)**: `.gemini/agents/*.md` and `.gemini/skills/**`, paired with root [GEMINI.md](./GEMINI.md).
- **Codex (`--target=codex`)**: `.codex/agents/*.toml` with rewritten `.agents/skills/` relative links (Codex reads [AGENTS.md](./AGENTS.md) and `.agents/skills/` natively).
