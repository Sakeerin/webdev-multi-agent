---
name: frontend-ui-engineering
description: >-
  Use this skill when designing or building web user interfaces, translating
  Stitch HTML specs or Figma designs into responsive 375px mobile-first
  components, semantic HTML, accessible layouts, and clean state management.
---

# Frontend UI Engineering

Build maintainable, accessible, mobile-first web interfaces starting at `375px`.

## Steps

1. **Inspect the Design Spec First**
   - If a Stitch project/screen exists, retrieve its HTML/design system via `StitchMCP` before writing markup.
   - Extract color tokens, typography scale, spacing rhythm, and component hierarchy.
2. **Design 375px Mobile-First**
   - Author base styles for a `375px` viewport with zero horizontal overflow (`overflow-x` clean).
   - Scale progressively using clean breakpoints (`sm` / `md` / `lg` / `xl`).
   - Ensure touch targets are at least `44x44px` on mobile.
3. **Write Semantic & Accessible Markup**
   - Use proper landmarks (`<header>`, `<main>`, `<nav>`, `<section>`, `<footer>`), button vs. link semantics, and form `<label>` associations.
   - Support full keyboard navigation (`Tab`, `Enter`, `Escape`) and visible focus rings.
4. **Implement All UI States**
   - Every data-driven view must handle **loading**, **empty**, **error**, and **populated** states cleanly.
   - Reserve explicit dimensions for images/media to prevent Cumulative Layout Shift (`CLS`).

## Validation Checklist
- [ ] Layout renders cleanly at `375px` without horizontal scrolling.
- [ ] Semantic HTML and keyboard focus order verified.
- [ ] Loading, empty, and error states implemented.
- [ ] Type-check, lint, and production build succeed with zero errors.
