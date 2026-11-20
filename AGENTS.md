# AGENTS.md — Web Developer Multi-Agent Playbook

This repository uses a **deterministic multi-agent workflow**. The main agent acts strictly as the **Orchestrator**: it plans work, delegates each step to the owning sub-agent, verifies the returned proof, and enforces quality gates.

## Core Principles

1. **Small Context, Specialized Execution**: Each sub-agent loads only its own skills so every job is done the same way every time.
2. **Proof-Driven Handoffs**: No step is complete until the owning sub-agent returns its required proof.
3. **Never Skip a Step**: Every non-trivial task follows the 6-step pipeline below in order. (Only explicit user-approved hotfixes may skip steps.)
4. **2-Strike Circuit Breaker**: If any sub-agent fails the same step **twice**, stop immediately, summarize the failure evidence, and ask the user for direction.

---

## Sub-Agent Roster

| Sub-Agent | Definition | Assigned Skills |
| :--- | :--- | :--- |
| `web-dev` | `.agents/agents/web-dev.md` | `frontend-ui-engineering`, `impeccable`, `incremental-implementation` |
| `tester` | `.agents/agents/tester.md` | `tdd`, `browser-testing-with-devtools` |
| `security-auditor` | `.agents/agents/security-auditor.md` | `security-and-hardening`, `firebase-security-rules-auditor` |
| `devops` | `.agents/agents/devops.md` | `ci-cd-and-automation`, `shipping-and-launch` |

---

## The 6-Step Orchestration Pipeline

| Step | Stage | Owner | Action | Required Proof |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Plan** | Main Agent | Break the user request into concrete steps, acceptance criteria, and edge cases. Write the plan to `PLAN.md`. | Updated `PLAN.md` with clear scope, tasks, and verification criteria. |
| **2** | **Design** | `web-dev` | Produce or translate the UI spec **375px mobile-first** (from Stitch HTML spec, Figma, or design tokens). Define layout, typography, spacing, and interactive states. | 375px-first component/layout spec or Stitch HTML reference + responsive breakpoints. |
| **3** | **Build** | `web-dev` | Implement incrementally in **small, focused commits**, writing or updating **tests first** (coordinating with `tdd` expectations). Keep lint and build green at every slice. | Clean git diff / small commits, passing unit tests, passing lint & production build. |
| **4** | **Verify** | `tester` | Run automated tests and verify the live app in a real browser using DevTools (`chrome-devtools-mcp`) at mobile (`375px`) and desktop viewports. | Passing test output, mobile + desktop screenshots, **LCP / INP / CLS** metrics, zero console/network errors. |
| **5** | **Secure** | `security-auditor` | Audit authentication, authorization, input validation, data exposure, secrets, dependencies, and database/Firebase security rules. | Structured Security Audit report (`PASS` or `FAIL` with severity-ranked findings). |
| **6** | **Ship** | `devops` | Prepare release checklist, verify CI pipeline, open the Pull Request (or deploy preview/production when requested). Let CI decide merge readiness. | PR link / summary, CI status checks, and deployment verification URL (if deployed). |

---

## Failure & Escalation Rules

- **Verify (`tester`) fails**: Return the exact failure logs, screenshots, and Core Web Vitals metrics to `web-dev` for a targeted fix (attempt 1 of 2).
- **Secure (`security-auditor`) finds Critical/High issues**: Block shipping and return actionable remediation items to `web-dev` (attempt 1 of 2).
- **Sub-agent fails twice**: Trigger the **Circuit Breaker** — stop all automated retries, present both failure proofs to the user, and wait for human guidance.

---

## Tooling Defaults (Mix & Match)

- **Design**: Stitch (`StitchMCP`) or Figma / HTML spec
- **Code**: Antigravity (compatible with Claude Code via `CLAUDE.md`, Codex, Gemini CLI, and Cursor via `.agents/skills/`)
- **Verify**: Chrome DevTools MCP (`chrome-devtools-mcp`), Lighthouse / Core Web Vitals
- **Ship**: Git / GitHub PR + CI Gates, Firebase App Hosting / Cloud Run / Vercel / Netlify
