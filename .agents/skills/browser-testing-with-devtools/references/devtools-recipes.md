# Chrome DevTools MCP Audit Recipes

Use these copy-pasteable `evaluate_script` and trace guidelines during **Step 4 (Verify)** alongside [SKILL.md](../SKILL.md).

---

## 1. Check `375px` Horizontal Overflow & Pinpoint Offending Elements

Run after resizing or emulating `375x812` to confirm `scrollWidth <= clientWidth` and locate any overflowing node:

```js
() => {
  const docEl = document.documentElement;
  const viewportWidth = docEl.clientWidth;
  const scrollWidth = docEl.scrollWidth;
  const offenders = [];

  for (const el of document.querySelectorAll('body *')) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.right > viewportWidth + 0.5 || rect.left < -0.5) {
      const id = el.id ? `#${el.id}` : '';
      const cls =
        typeof el.className === 'string' && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
          : '';
      offenders.push({
        selector: `${el.tagName.toLowerCase()}${id}${cls}`,
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
      });
    }
  }

  return {
    pass: scrollWidth <= viewportWidth && offenders.length === 0,
    viewportWidth,
    scrollWidth,
    overflowPx: Math.max(0, scrollWidth - viewportWidth),
    offenders: offenders.slice(0, 10),
  };
}
```

---

## 2. Audit `>= 44x44px` Interactive Touch Targets (Mobile Ergonomics)

Run at `375x812` to verify visible interactive controls meet the `44x44px` minimum tap area:

```js
() => {
  const MIN_SIZE = 44;
  const selector = 'button, a[href], input, select, textarea, [role="button"], label';
  const checked = [];
  const undersized = [];

  for (const el of document.querySelectorAll(selector)) {
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      el.hasAttribute('hidden') ||
      (el.tagName === 'INPUT' && el.type === 'hidden')
    ) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    // Skip labels wrapping an input/control that already meets >= 44x44px
    if (el.tagName === 'LABEL' && el.querySelector('input, select, textarea')) continue;

    const item = {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') || el.textContent || el.name || '').trim().slice(0, 40),
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
    };
    checked.push(item);

    if (rect.width + 0.5 < MIN_SIZE || rect.height + 0.5 < MIN_SIZE) {
      undersized.push(item);
    }
  }

  return {
    pass: undersized.length === 0,
    totalChecked: checked.length,
    undersizedCount: undersized.length,
    undersized,
  };
}
```

---

## 3. Inject Corrupted `localStorage` Payload (Resilience & Recovery Check)

Seed malformed JSON into an app storage key, reload the page, and confirm the UI recovers gracefully (e.g., renders an accessible recovery banner with `0` uncaught console errors):

```js
() => {
  const STORAGE_KEY = 'sprint_pulse_tasks_v1'; // Replace with the app's storage key
  window.localStorage.setItem(STORAGE_KEY, '{"corrupted": [unclosed_json');
  return { seededKey: STORAGE_KEY, rawValue: window.localStorage.getItem(STORAGE_KEY) };
}
```

After reloading (`navigate_page` with `type: "reload"`):
1. Verify `list_console_messages` reports **zero** uncaught `SyntaxError` / `TypeError` exceptions.
2. Confirm the recovery notice/banner is visible and dismissible.
3. Clean up `window.localStorage.removeItem(STORAGE_KEY)` if needed after capturing proof.

---

## 4. Interpreting Mobile Core Web Vitals (`LCP`, `INP`, `CLS`)

Capture traces on mobile (`375x812`) via `performance_start_trace` -> reload + interact -> `performance_stop_trace` (and/or `lighthouse_audit`):

| Metric | Target (`PASS`) | Needs Work / `FAIL` | Common Root Causes & Fixes |
| :--- | :--- | :--- | :--- |
| **LCP** (Largest Contentful Paint) | `<= 2.5s` (`2500ms`) | `> 2.5s` | Uncompressed hero media, render-blocking CSS/fonts, slow client waterfall. Preload critical assets and inline/minimize above-the-fold styles. |
| **INP** (Interaction to Next Paint) | `<= 200ms` | `> 200ms` | Long main-thread synchronous tasks (`> 50ms`) during `click` / `input` handlers or full-list DOM re-renders. Yield work or scope updates cleanly. |
| **CLS** (Cumulative Layout Shift) | `<= 0.1` | `> 0.1` | Images/skeletons/banners injected without reserved dimensions or `font-display` swaps shifting layout. Add explicit `width`/`height` or `min-height`. |
