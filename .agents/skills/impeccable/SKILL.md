---
name: impeccable
description: >-
  Use this skill when polishing UI craft, refining visual hierarchy, typography,
  spacing, contrast, micro-interactions, and eliminating generic or rough
  visual details before handing off frontend work.
---

# Impeccable UI Craft

Elevate functional UI into cohesive, production-grade visual quality.

## Steps

1. **Audit Visual Hierarchy & Spacing**
   - Verify a clear primary focal point on every screen.
   - Enforce a consistent spacing scale (e.g., 4px/8px grid) and balanced whitespace — avoid cramped cards or inconsistent padding.
2. **Refine Typography & Color Contrast**
   - Limit font families and maintain clear size/weight contrast between headings, body, and captions.
   - Verify text/background contrast meets **WCAG AA** (`>= 4.5:1` for normal text, `>= 3:1` for large text and UI controls).
3. **Polish Interactive Feedback**
   - Add crisp, restrained hover, active, focus-visible, and disabled states for every interactive element.
   - Use subtle transitions (`150ms–250ms`, GPU-friendly `transform`/`opacity`) and respect `prefers-reduced-motion`.
4. **Eliminate Visual Papercuts**
   - Check text truncation/wrapping on long strings, icon alignment, border radius harmony, and dark/light theme consistency (if applicable).

## Validation Checklist
- [ ] Typography, spacing, and alignment are visually consistent across components.
- [ ] Contrast meets WCAG AA in all states.
- [ ] Micro-interactions feel responsive and respect `prefers-reduced-motion`.
- [ ] No broken icons, clipped text, or awkward wrapping at `375px` or desktop.
