---
name: browser-testing-with-devtools
description: >-
  Use this skill when verifying a running web application in a real browser
  using Chrome DevTools MCP: capturing mobile (375px) and desktop screenshots,
  checking console/network errors, and measuring Core Web Vitals (LCP, INP, CLS).
---

# Browser Testing with DevTools

Verify live UI behavior, visual fidelity, runtime health, and mobile performance using `chrome-devtools-mcp`.

## Steps

1. **Open & Emulate Mobile First (`375px`)**
   - Navigate to the running app URL using `chrome-devtools-mcp` (`new_page` / `navigate_page`).
   - Resize or emulate a mobile viewport (`375x812`) first, matching the mobile-first design requirement.
2. **Inspect Runtime Health**
   - Check `list_console_messages` for any `error` or uncaught exception.
   - Check `list_network_requests` for failed requests (`status >= 400`) or blocked assets.
3. **Exercise Critical User Flows**
   - Interact with primary flows (`click`, `fill`, `press_key`, `wait_for`) and confirm expected DOM/state transitions.
   - Capture screenshots (`take_screenshot`) at mobile (`375x812`) and desktop (`1280x800`) viewports.
4. **Measure Mobile Core Web Vitals (`LCP`, `INP`, `CLS`)**
   - Run a performance trace (`performance_start_trace` -> reload/interact -> `performance_stop_trace`) and/or `lighthouse_audit` on mobile emulation.
   - Evaluate against targets:
     - **LCP**: `<= 2.5s`
     - **INP**: `<= 200ms`
     - **CLS**: `<= 0.1`

## Validation Checklist
- [ ] Mobile (`375px`) and desktop screenshots captured and visually inspected.
- [ ] Zero uncaught console errors and zero unexpected `4xx`/`5xx` network errors.
- [ ] Mobile `LCP`, `INP`, and `CLS` recorded and compared against thresholds.
- [ ] Report returns clear `PASS` or `FAIL` with reproduction steps for any defect.

See [references/devtools-recipes.md](./references/devtools-recipes.md) for ready-to-use DevTools audit scripts.
