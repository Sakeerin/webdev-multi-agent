# Sprint Pulse — 375px Mobile-First Design Specification

> **Pipeline Stage**: Step 2 (Design)  
> **Owner**: `web-dev`  
> **Target App**: `demo-app/` (Zero-dependency, offline-first vanilla HTML/CSS/JS web application)  
> **Design Philosophy**: Precision Utility — clear visual hierarchy, high-contrast scannability, generous touch ergonomics, and deterministic zero-CLS layout geometry.

---

## 1. Design System Tokens

All styling MUST consume semantic CSS custom properties declared on `:root`. External webfonts, icon CDNs, and third-party stylesheets are **prohibited** so LCP is immediate and font-swap CLS is strictly `0.000`.

```css
:root {
  /* === Color: Surfaces === */
  --color-bg-canvas: #f8fafc;       /* Page background */
  --color-bg-surface: #ffffff;      /* Primary cards, composer, controls */
  --color-bg-subtle: #f1f5f9;       /* Segmented control track, secondary fills */
  --color-bg-hover: #e2e8f0;        /* Subtle interactive hover fill */

  /* === Color: Borders === */
  --color-border-subtle: #cbd5e1;   /* Card hairline dividers */
  --color-border-control: #64748b;  /* Inputs, checkboxes, buttons (>= 3:1 WCAG 1.4.11) */
  --color-border-focus: #1d4ed8;    /* Visible keyboard focus ring */

  /* === Color: Typography === */
  --color-text-primary: #0f172a;    /* Headings, primary task titles */
  --color-text-secondary: #475569;  /* Subtitles, metadata, counts */
  --color-text-muted: #526071;      /* Placeholders, helper captions (AA-safe on all surfaces) */
  --color-text-inverse: #ffffff;    /* Text on primary accent buttons */

  /* === Color: Brand / Primary Accent === */
  --color-accent-primary: #1d4ed8;  /* Primary CTA, active filter pill, progress fill */
  --color-accent-hover: #1e40af;    /* Primary CTA hover/active */
  --color-accent-soft: #eff6ff;     /* Selected/subtle accent tint */

  /* === Color: Semantic Feedback === */
  --color-success-bg: #ecfdf5;
  --color-success-text: #047857;
  --color-success-border: #6ee7b7;

  --color-warning-bg: #fffbeb;
  --color-warning-text: #92400e;
  --color-warning-border: #fcd34d;

  --color-danger-bg: #fef2f2;
  --color-danger-text: #b91c1c;
  --color-danger-border: #fca5a5;

  /* === Color: Pipeline Stage Badges (6 Stages) === */
  --stage-plan-bg: #f1f5f9;         --stage-plan-text: #334155;
  --stage-design-bg: #f5f3ff;       --stage-design-text: #5b21b6;
  --stage-build-bg: #eff6ff;        --stage-build-text: #1d4ed8;
  --stage-verify-bg: #fffbeb;       --stage-verify-text: #92400e;
  --stage-secure-bg: #fdf2f8;       --stage-secure-text: #9d174d;
  --stage-ship-bg: #ecfdf5;         --stage-ship-text: #047857;

  /* === Color: Priority Badges (3 Levels) === */
  --priority-low-bg: #f1f5f9;       --priority-low-text: #475569;
  --priority-medium-bg: #fff7ed;    --priority-medium-text: #9a3412;
  --priority-high-bg: #fef2f2;      --priority-high-text: #b91c1c;

  /* === Typography (Zero External Network Dependencies) === */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
               "Liberation Mono", "Courier New", monospace;

  /* Type Scale (1rem = 16px base; inputs >= 16px to prevent iOS auto-zoom) */
  --text-xs: 0.75rem;               /* 12px / line-height 1.33 — badges, uppercase labels */
  --text-sm: 0.875rem;              /* 14px / line-height 1.43 — secondary metadata, hints */
  --text-base: 1rem;                /* 16px / line-height 1.50 — body, inputs, task titles */
  --text-lg: 1.125rem;              /* 18px / line-height 1.35 — section headings */
  --text-xl: 1.5rem;                /* 24px / line-height 1.25 — mobile app title */
  --text-2xl: 1.75rem;              /* 28px / line-height 1.20 — desktop app title */

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* === Spacing Scale (4px / 8px Grid) === */
  --space-1: 0.25rem;               /* 4px */
  --space-2: 0.5rem;                /* 8px */
  --space-3: 0.75rem;               /* 12px */
  --space-4: 1rem;                  /* 16px */
  --space-5: 1.25rem;               /* 20px */
  --space-6: 1.5rem;                /* 24px */
  --space-8: 2rem;                  /* 32px */
  --space-10: 2.5rem;               /* 40px */

  /* === Touch Targets & Control Geometry === */
  --touch-target-min: 44px;         /* Strict WCAG 2.5.5 / mobile tap floor */
  --container-max-tablet: 720px;
  --container-max-desktop: 1080px;

  /* === Radii === */
  --radius-sm: 6px;                 /* Badges, small pills */
  --radius-md: 10px;                /* Inputs, buttons, alerts */
  --radius-lg: 14px;                /* Cards, composer panel */
  --radius-full: 9999px;            /* Progress track, circular indicators */

  /* === Elevation (Restrained, High-Clarity Borders + Soft Shadows) === */
  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04);
  --shadow-focus: 0 0 0 3px rgba(29, 78, 216, 0.28);

  /* === Motion === */
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

---

## 2. WCAG AA Contrast Verification Table

All text pairings meet or exceed **WCAG 2.1 AA (`>= 4.5:1` normal text, `>= 3.0:1` large text & UI controls)**.

| Element / Role | Foreground Token (`Hex`) | Background Token (`Hex`) | Ratio | WCAG Threshold | Status |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Primary text on surface | `--color-text-primary` (`#0F172A`) | `--color-bg-surface` (`#FFFFFF`) | **17.85:1** | `>= 4.5:1` | PASS (AAA) |
| Primary text on canvas | `--color-text-primary` (`#0F172A`) | `--color-bg-canvas` (`#F8FAFC`) | **17.07:1** | `>= 4.5:1` | PASS (AAA) |
| Secondary text on surface | `--color-text-secondary` (`#475569`) | `--color-bg-surface` (`#FFFFFF`) | **7.58:1** | `>= 4.5:1` | PASS (AAA) |
| Secondary text on subtle track | `--color-text-secondary` (`#475569`) | `--color-bg-subtle` (`#F1F5F9`) | **6.92:1** | `>= 4.5:1` | PASS (AA+) |
| Muted text / placeholder on surface | `--color-text-muted` (`#526071`) | `--color-bg-surface` (`#FFFFFF`) | **6.43:1** | `>= 4.5:1` | PASS (AA) |
| Muted text on subtle fill | `--color-text-muted` (`#526071`) | `--color-bg-subtle` (`#F1F5F9`) | **5.87:1** | `>= 4.5:1` | PASS (AA) |
| Primary button label | `--color-text-inverse` (`#FFFFFF`) | `--color-accent-primary` (`#1D4ED8`) | **6.70:1** | `>= 4.5:1` | PASS (AA+) |
| Primary button label (hover) | `--color-text-inverse` (`#FFFFFF`) | `--color-accent-hover` (`#1E40AF`) | **8.71:1** | `>= 4.5:1` | PASS (AAA) |
| Accent link / active tab text | `--color-accent-primary` (`#1D4ED8`) | `--color-accent-soft` (`#EFF6FF`) | **6.25:1** | `>= 4.5:1` | PASS (AA) |
| Input & checkbox border | `--color-border-control` (`#64748B`) | `--color-bg-surface` (`#FFFFFF`) | **4.76:1** | `>= 3.0:1` | PASS (AA) |
| Focus outline ring | `--color-border-focus` (`#1D4ED8`) | `--color-bg-surface` (`#FFFFFF`) | **6.70:1** | `>= 3.0:1` | PASS (AA) |
| Inline error / danger button text | `--color-danger-text` (`#B91C1C`) | `--color-bg-surface` (`#FFFFFF`) | **6.47:1** | `>= 4.5:1` | PASS (AA) |
| Storage recovery / danger banner | `--color-danger-text` (`#B91C1C`) | `--color-danger-bg` (`#FEF2F2`) | **5.96:1** | `>= 4.5:1` | PASS (AA) |
| Warning banner text | `--color-warning-text` (`#92400E`) | `--color-warning-bg` (`#FFFBEB`) | **6.86:1** | `>= 4.5:1` | PASS (AA+) |
| Stage Badge: **Plan** | `--stage-plan-text` (`#334155`) | `--stage-plan-bg` (`#F1F5F9`) | **9.40:1** | `>= 4.5:1` | PASS (AAA) |
| Stage Badge: **Design** | `--stage-design-text` (`#5B21B6`) | `--stage-design-bg` (`#F5F3FF`) | **8.20:1** | `>= 4.5:1` | PASS (AAA) |
| Stage Badge: **Build** | `--stage-build-text` (`#1D4ED8`) | `--stage-build-bg` (`#EFF6FF`) | **6.25:1** | `>= 4.5:1` | PASS (AA) |
| Stage Badge: **Verify** | `--stage-verify-text` (`#92400E`) | `--stage-verify-bg` (`#FFFBEB`) | **6.86:1** | `>= 4.5:1` | PASS (AA+) |
| Stage Badge: **Secure** | `--stage-secure-text` (`#9D174D`) | `--stage-secure-bg` (`#FDF2F8`) | **7.20:1** | `>= 4.5:1` | PASS (AAA) |
| Stage Badge: **Ship** | `--stage-ship-text` (`#047857`) | `--stage-ship-bg` (`#ECFDF5`) | **5.22:1** | `>= 4.5:1` | PASS (AA) |
| Priority Badge: **Low** | `--priority-low-text` (`#475569`) | `--priority-low-bg` (`#F1F5F9`) | **6.92:1** | `>= 4.5:1` | PASS (AA+) |
| Priority Badge: **Medium** | `--priority-medium-text` (`#9A3412`) | `--priority-medium-bg` (`#FFF7ED`) | **6.90:1** | `>= 4.5:1` | PASS (AA+) |
| Priority Badge: **High** | `--priority-high-text` (`#B91C1C`) | `--priority-high-bg` (`#FEF2F2`) | **5.96:1** | `>= 4.5:1` | PASS (AA) |

---

## 3. Mobile-First (`375px`) Layout Architecture & Wireframe

Base CSS targets **`375px` width (`375 x 812`)** with `padding-inline: 16px` (`--space-4`), yielding an exact `343px` inner content column.

```text
+---------------------------------------------+  <- 375px viewport
|  [16px] <header> Sprint Pulse        [16px] |
|  Sprint Pulse                   3 / 6 Done  |
|  Pipeline task tracker                      |
|  [==============-----------] 50% complete   |
+---------------------------------------------+
|  [Optional: Storage Recovery Banner (role=alert)]
|  ! Saved sprint data was corrupted and reset. [Dismiss 44x44]
+---------------------------------------------+
|  <section> New Task Composer (Card)         |
|  Task Title *                       0 / 80  |
|  [ e.g., Audit Firestore rules... (44px h)] |
|  (Inline validation error slot, min-h 20px) |
|                                             |
|  Pipeline Stage         Priority            |
|  [ Plan           v ]   [ Medium       v ]  |  <- 2-col equal grid (min 44px h each)
|                                             |
|  [            + Add Task (44px h)         ] |  <- full-width primary CTA
+---------------------------------------------+
|  <section> Filter & Search Toolbar          |
|  +---------------------------------------+  |
|  | [ All (6) ] [ Active (3) ] [ Done (3)]|  |  <- 3 equal segments, each >= 44px h
|  +---------------------------------------+  |
|  [ Search tasks... (44px h)       [Clear] ] |
+---------------------------------------------+
|  <section> Sprint Tasks (<ul role="list">)  |
|  +---------------------------------------+  |
|  | [x 44x44] Implement input validation  |  |  <- title wraps cleanly, 0 overflow
|  |           for task title length       |  |
|  |           [Build]  [High]             |  |  <- wrapping flex row (gap 8px)
|  | ------------------------------------- |  |
|  | [ Advance -> Verify (44px h) ] [Del44]|  |  <- full tap targets, gap 8px
|  +---------------------------------------+  |
|  +---------------------------------------+  |
|  | [✓ 44x44] Initialize git repo (muted) |  |  <- strikethrough + reduced emphasis
|  |           [Ship]   [Low]              |  |
|  | ------------------------------------- |  |
|  | [ Stage: Shipped (disabled)  ] [Del44]|  |
|  +---------------------------------------+  |
+---------------------------------------------+
|  <footer> Local-only • Offline Ready        |
+---------------------------------------------+
```

### Touch Target (`>= 44x44px`) & Zero-Overflow Guarantees
1. **Every interactive element** (`input`, `select`, `button`, filter tabs, checkbox tap wrapper, clear-search button, banner dismiss button, `Advance` button, `Delete` button) MUST have `min-height: 44px` and `min-width: 44px`.
   - For the task completion checkbox, wrap the visual `20x20px` checkbox inside a `44x44px` flex-centered `<label>` or `<button role="checkbox">` hit area so visual density stays crisp while touch ergonomics strictly pass `44x44px`.
2. **Zero Horizontal Overflow (`scrollWidth <= clientWidth` at `375px`)**:
   - Global `*, *::before, *::after { box-sizing: border-box; }`.
   - Every flex/grid child holding dynamic text sets `min-width: 0`.
   - Task titles apply `overflow-wrap: anywhere; word-break: break-word;` so an unbroken 80-character string wraps neatly across lines without pushing card bounds.
   - `body` avoids `100vw` widths (uses `width: 100%`) to prevent Windows scrollbar horizontal overflow.
   - Form controls use `font-size: 1rem` (`16px`) to prevent iOS Safari focus zoom.

---

## 4. Responsive Breakpoint Progression

Mobile-first `@media (min-width: ...)` rules progressively enhance layout without duplicating markup:

| Breakpoint | Range | Container | Layout Structure | Component Adaptations |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile (Base)** | `375px – 767px` | `width: 100%`, `padding-inline: 16px` | Single-column vertical flow (`gap: 16px`) | Composer inputs stacked (`Stage` + `Priority` share a `1fr 1fr` row with `12px` gap); Filter segmented control stacks above Search input; Task cards stack metadata row above full-width action footer (`Advance` grows `flex: 1`, `Delete` is `44x44px` icon/label button). |
| **Tablet (`md`)** | `768px – 1023px` | `max-width: 720px`, `margin-inline: auto`, `padding-inline: 24px` | Single-column centered canvas (`gap: 20px`) | Header places title & KPI summary side-by-side; Filter segmented control + Search input share one horizontal flex row (`gap: 12px`); Task card actions sit cleanly in an inline footer or right-aligned action group with `padding: 16px 20px`. |
| **Desktop (`lg`)** | `>= 1024px` | `max-width: 1080px`, `margin-inline: auto`, `padding-inline: 32px` | 2-column CSS Grid: `grid-template-columns: 340px minmax(0, 1fr); gap: 28px; align-items: start;` | Left column (`position: sticky; top: 24px`): Compact Sprint Progress card + New Task Composer. Right column: Filter/Search Toolbar + Task List (`ul`). App title scales from `24px` to `28px`. |

---

## 5. Semantic HTML Landmark Structure & Keyboard Accessibility Plan

### Landmark Hierarchy
```html
<body>
  <a class="skip-link" href="#main-content">Skip to tasks</a>

  <header class="app-header">
    <!-- Brand title (<h1>), tagline, and Sprint Progress bar (role="progressbar") -->
  </header>

  <main id="main-content" class="app-workspace">
    <!-- Optional non-blocking storage recovery banner (<div role="alert" hidden>) -->

    <section class="composer-panel" aria-labelledby="composer-heading">
      <h2 id="composer-heading">Add Sprint Task</h2>
      <form id="task-form" novalidate>
        <!-- Explicit <label for="..."> for Title, Stage, Priority -->
        <!-- Live character counter (0 / 80) + aria-describedby error message -->
        <!-- <button type="submit">Add Task</button> -->
      </form>
    </section>

    <section class="tasks-panel" aria-labelledby="tasks-heading">
      <h2 id="tasks-heading" class="sr-only">Sprint Task List</h2>

      <div class="toolbar" role="search" aria-label="Filter and search tasks">
        <div class="filter-group" role="group" aria-label="Filter by status">
          <!-- <button type="button" aria-pressed="true|false"> All / Active / Done -->
        </div>
        <!-- Search <label> + <input type="search"> + Clear button -->
      </div>

      <!-- Status live region for screen reader announcements (visually hidden) -->
      <div id="sr-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>

      <!-- Loading skeleton container (hidden after sync hydration) -->
      <!-- Empty state container (hidden when tasks visible) -->
      <ul id="task-list" class="task-list" role="list">
        <!-- Each task is a semantic <li> with textContent-only dynamic strings (XSS-safe) -->
      </ul>
    </section>
  </main>

  <footer class="app-footer">
    <!-- Local persistence indicator & pipeline legend -->
  </footer>
</body>
```

### Keyboard & Assistive Technology Plan
- **Skip Link**: First focusable element (`Skip to tasks`), visually hidden until `:focus-visible`, jumps straight to `#main-content`.
- **Tab Order**: Strictly follows visual DOM order: Skip Link -> Recovery Banner Dismiss (if shown) -> Task Title Input -> Stage Select -> Priority Select -> Add Task Button -> Filter Buttons (`All`, `Active`, `Done`) -> Search Input -> Clear Search (if text present) -> Per-task `[Toggle Done]` -> `[Advance Stage]` -> `[Delete]`.
- **Keyboard Shortcuts**:
  - `Enter` inside Task Title input submits the form.
  - `Escape` inside Search input clears the query and retains focus on the search field.
  - `Space` / `Enter` activates all native `<button>` and `<input type="checkbox">` controls.
- **Focus Visibility**: Universal `:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: 2px; box-shadow: var(--shadow-focus); }`.
- **Focus Management on Delete**: When a task is deleted via keyboard, move focus to the next task's toggle button, or previous task if last, or `#task-search` / `#task-title` if list becomes empty.
- **Live Announcements**: `#sr-status` (`aria-live="polite"`) announces mutations concisely (`"Task added"`, `"Moved to Verify"`, `"Marked complete"`, `"Task deleted"`, `"Filters reset"`).
- **XSS Safety Rule**: All user-entered text (task title, search query echo in empty state) MUST be injected via `.textContent` or `document.createTextNode()`, never `.innerHTML`.

---

## 6. UI States Specification

### A. Loading State (Initial Hydration Skeleton)
- **When shown**: Rendered in initial HTML before JS finishes synchronous `localStorage` hydration (or toggled via `data-state="loading"`).
- **Visual Spec**: 3 stacked skeleton task cards inside `#loading-skeleton` with fixed height (`122px` mobile / `96px` desktop) matching populated task card geometry to guarantee `CLS = 0`.
- **Styling**: Neutral `--color-bg-subtle` (`#F1F5F9`) rounded bars with subtle `opacity` pulse (`1.4s ease-in-out infinite`, disabled under `prefers-reduced-motion`). Container carries `aria-busy="true"` and `aria-label="Loading sprint tasks"`.

### B. Empty States (2 Distinct Variants)
1. **No Tasks Yet (First-Run / All Deleted)**:
   - Centered surface card (`padding: 32px 20px`, dashed `--color-border-subtle` border), minimal inline geometric SVG checklist icon (`40x40px`, explicit `width`/`height`).
   - Heading: `"No sprint tasks yet"`, helper text, and primary CTA button (`>= 44px` height): `"Create First Task"` focusing `#task-title`.
2. **No Matching Search / Filter Results**:
   - Triggered when `totalTasks > 0` but `filteredTasks.length === 0`.
   - Heading: `"No matching tasks"`, plain-text summary built via `textContent`, and `"Reset Filters"` button (`>= 44px` height).

### C. Error States (2 Distinct Variants)
1. **Form Validation Inline Error**:
   - Triggered on empty/whitespace-only title or title length `> 80` characters (or invalid stage/priority enum).
   - Sets `aria-invalid="true"` and `aria-describedby="title-error"` on `#task-title`, borders input with `--color-danger-text`.
   - Error message renders in a pre-reserved `min-height: 20px` slot directly below the input (`role="alert"`) for zero layout shift.
2. **Storage Corruption Recovery Banner**:
   - Triggered if `localStorage` contains malformed JSON or invalid schema on load.
   - Non-blocking full-width banner at top of `<main>` (`role="alert"`) with a `44x44px` `"Dismiss"` button.

### D. Populated State
- **Progress Header**: Shows completion ratio (`"2 of 5 complete • 40%"`) + horizontal progress bar (`height: 8px`, `border-radius: 9999px`) animated with GPU-composited `transform: scaleX(...)`.
- **Task Card Anatomy**:
  - Top row: `44x44px` toggle checkbox hit area + Title (`16px` medium, `overflow-wrap: anywhere`) + subtle completed styling (`text-decoration: line-through`, `--color-text-secondary`).
  - Metadata row: Pipeline Stage badge (`Plan`..`Ship`) + Priority badge (`Low`/`Medium`/`High`).
  - Action row: `"Advance -> [NextStage]"` button (`min-height: 44px`; disabled `"Shipped"` at `Ship`) + `"Delete"` button (`min-height: 44px`, `min-width: 44px`).

---

## 7. Micro-Interactions, Reduced Motion & CLS Prevention

- **Micro-Interactions (`150ms`–`200ms`)**: Fast button/pill feedback (`transform: scale(0.98)` on `:active`), GPU-composited `scaleX` progress bar, subtle pointer hover elevation, and strict `@media (prefers-reduced-motion: reduce)` override.
- **Core Web Vitals & CLS Prevention**: Zero external fonts, pre-reserved `#title-error` slot, explicit SVG dimensions, synchronous hydration matching skeleton dimensions, and minimal `DocumentFragment` DOM updates for crisp `INP <= 200ms`.
