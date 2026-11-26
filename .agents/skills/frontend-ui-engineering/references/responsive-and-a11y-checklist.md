# Responsive `375px` Mobile-First & WCAG 2.1 AA Checklist

Use this reference alongside [SKILL.md](../SKILL.md) during **Step 2 (Design)** and **Step 3 (Build)**.

---

## 1. Breakpoint Progression (`375px` → `1280px`)

Author base CSS for a `375px` mobile viewport first, then layer progressive `min-width` enhancements:

| Tier | Viewport | Layout Pattern | Gutter / Max Container |
| :--- | :--- | :--- | :--- |
| **Base (Mobile)** | `375px – 767px` | Single-column stack (`1fr`), sticky bottom or compact top actions, `0px` horizontal overflow | `16px` (`1rem`) inline padding |
| **Tablet (`md`)** | `>= 768px` | 2-column asymmetric or balanced grid (`repeat(2, minmax(0, 1fr))`), inline filter toolbars | `24px` (`1.5rem`) inline padding |
| **Laptop (`lg`)** | `>= 1024px` | Persistent sidebar + main workspace (`260px minmax(0, 1fr)`) or 3-column card grid | `32px` (`2rem`) inline padding |
| **Desktop (`xl`)** | `>= 1280px` | Centered container with constrained reading measure (`60ch–72ch` for prose) | `max-width: 1200px` (`75rem`) |

```css
.app-shell {
  width: min(100% - 2rem, 75rem);
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

@media (min-width: 48rem) { /* 768px */
  .app-shell {
    width: min(100% - 3rem, 75rem);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-6);
  }
}

@media (min-width: 64rem) { /* 1024px */
  .app-shell {
    grid-template-columns: 16.25rem minmax(0, 1fr);
  }
}
```

---

## 2. Fluid Spacing & Typography Tokens

Define predictable CSS custom properties on `:root` using `rem` and `clamp()` so users who zoom to `200%` never lose legibility:

```css
:root {
  /* 4px / 8px spatial scale */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */

  /* Fluid type scale (never lock body copy below 16px / 1rem on mobile inputs) */
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem);
  --text-xl: clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem);
  --text-2xl: clamp(1.75rem, 1.45rem + 1.4vw, 2.375rem);
}
```

- **Prevent iOS Input Auto-Zoom**: Keep `<input>`, `<select>`, and `<textarea>` font-size at `>= 16px` (`1rem`) on mobile viewports.
- **Prevent Grid Blowout**: Always use `minmax(0, 1fr)` (not bare `1fr`) and `overflow-wrap: anywhere` on user-generated titles/URLs so long strings cannot trigger horizontal scrolling at `375px`.

---

## 3. WCAG 2.1 AA Contrast, Touch Targets & Keyboard Focus

- [ ] **Text Contrast**: Normal body text (`< 18pt` / `< 24px`, or `< 14pt` bold) achieves **`>= 4.5:1`** contrast against its background; large text and UI boundaries/icons achieve **`>= 3.0:1`**.
- [ ] **Touch Targets**: Interactive controls (`<button>`, `<a>`, checkboxes, filter pills, icon actions) maintain at least **`44x44px`** hit area on mobile (`min-height: 2.75rem; min-width: 2.75rem`).
- [ ] **Keyboard Navigation**:
  - Use native `<button type="button">` for actions and `<a href="...">` for navigation — never `<div onClick>`.
  - Every interactive element shows a high-contrast `:focus-visible` ring (`outline: 2px solid var(--focus-ring); outline-offset: 2px`) and never sets `outline: none` without an accessible replacement.
  - Modals/drawers trap `Tab` / `Shift+Tab`, close on `Escape`, and restore focus to the trigger element on close.
- [ ] **Forms & Live Regions**:
  - Pair every control with an explicit `<label for="...">` (avoid placeholder-only labels).
  - Bind inline validation errors with `aria-invalid="true"` and `aria-describedby` + `role="alert"` / `aria-live="polite"`.
- [ ] **Reduced Motion**: Wrap non-essential transitions and keyframe animations inside `@media (prefers-reduced-motion: no-preference)` (or shorten durations to `0.01ms` under `prefers-reduced-motion: reduce`).

---

## 4. Zero-CLS Media, Fonts & UI State Rules (`CLS <= 0.1`)

- [ ] **Explicit Media Geometry**: Always set `width` and `height` attributes (or CSS `aspect-ratio`) on `<img>`, `<svg>`, `<video>`, and `<iframe>` elements. Prioritize hero media with `fetchpriority="high"` (never `loading="lazy"` above the fold).
- [ ] **Dimension-Matched Skeletons**: Loading skeletons, empty states, and error banners must reserve the exact min-height of their populated container so hydration or async fetches cause `0.00` layout shift.
- [ ] **Font Loading**: Use `font-display: swap` or `optional` with metric-compatible fallback stacks (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`).
- [ ] **Complete State Matrix**: Verify **Loading**, **Empty**, **Error** (with retry action), and **Populated** states at both `375x812` and `1280x800`.
