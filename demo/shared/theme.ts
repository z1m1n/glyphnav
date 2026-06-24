/**
 * Light / dark / system theme switcher for the demo pages.
 *
 * Auto-detects the OS `prefers-color-scheme` by default, with a manual override
 * the visitor can cycle through and which is remembered (localStorage). The
 * resolved theme is expressed as `data-theme="light|dark"` on `<html>`; the
 * stylesheet keeps the dark palette under `:root[data-theme='dark']` (see
 * demo/shared/styles.css), so flipping the attribute reskins the whole page —
 * including the native widgets, via `color-scheme`.
 *
 * Two halves, so an explicit choice never flashes the wrong theme on load:
 *  - {@link THEME_INIT_SCRIPT} is a tiny, self-contained classic script each
 *    build pipeline inlines at the top of `<head>` (Vite plugin / Next root
 *    layout / Nuxt `useHead`). It runs *before first paint* and sets the
 *    attribute from the saved preference (resolving `system` against the OS).
 *  - {@link initTheme} runs once the DOM is interactive: it injects the floating
 *    toggle, keeps `system` mode tracking the OS, and re-applies on change.
 *
 * Framework-agnostic by design (like demo/shared/tooltip.ts): the toggle is a
 * plain element appended to `document.body`, outside any framework root, so it
 * survives re-renders. Idempotent and SSR-safe — call {@link initTheme} once per
 * demo after mount.
 */

/** The remembered choice. `system` is the absence of an override (default). */
export type ThemePref = 'system' | 'light' | 'dark';

/** localStorage key holding the override (`light`/`dark`); absent ⇒ `system`. */
const STORE_KEY = 'glyphnav-theme';
/** Click order: each press advances to the next, wrapping back to `system`. */
const ORDER: ThemePref[] = ['system', 'light', 'dark'];

/** `theme-color` (mobile browser chrome) per resolved theme — matches --white. */
const META_COLOR: Record<'light' | 'dark', string> = {
  light: '#ffffff',
  dark: '#16181c',
};

/**
 * Pre-paint init, inlined verbatim as a classic `<script>` in `<head>`. Kept
 * tiny, dependency-free and wrapped in try/catch since it runs before anything
 * else (and before hydration). Mirrors {@link resolve}'s logic so the attribute
 * the module later reconciles already matches.
 */
export const THEME_INIT_SCRIPT =
  `(function(){try{var p=localStorage.getItem('${STORE_KEY}');` +
  `var t=(p==='light'||p==='dark')?p:` +
  `(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');` +
  `document.documentElement.dataset.theme=t;}catch(e){}})();`;

/** Inline-stroke icons (one per preference), drawn in `currentColor`. */
const ICONS: Record<ThemePref, string> = {
  system:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  light:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

/** Button label per preference: current state, plus the choice a click brings. */
const LABELS: Record<ThemePref, string> = {
  system: 'Theme: system (matches your device) — click for light',
  light: 'Theme: light — click for dark',
  dark: 'Theme: dark — click for system',
};

let initialized = false;
let button: HTMLButtonElement | null = null;
let pref: ThemePref = 'system';

const prefersDark = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

/** Collapse a preference to the concrete theme to paint. */
const resolve = (p: ThemePref): 'light' | 'dark' =>
  p === 'system' ? (prefersDark() ? 'dark' : 'light') : p;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage blocked (private mode, etc.) — fall back to system */
  }
  return 'system';
}

function savePref(p: ThemePref): void {
  try {
    if (p === 'system') localStorage.removeItem(STORE_KEY);
    else localStorage.setItem(STORE_KEY, p);
  } catch {
    /* ignore — the override just won't persist */
  }
}

/** Reflect `p` onto the document: the data-theme attribute + theme-color meta. */
function apply(p: ThemePref): void {
  const theme = resolve(p);
  document.documentElement.dataset.theme = theme;
  const meta =
    document.querySelector('meta[name="theme-color"]:not([media])') ??
    document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', META_COLOR[theme]);
}

/** Sync the toggle's icon and labels to the current preference. */
function render(): void {
  if (!button) return;
  button.innerHTML = ICONS[pref];
  button.title = LABELS[pref];
  button.setAttribute('aria-label', LABELS[pref]);
}

/** Advance to the next preference, persist, repaint and relabel. */
function cycle(): void {
  pref = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  savePref(pref);
  apply(pref);
  render();
}

/**
 * Mount the theme switcher. Idempotent and SSR-safe — call once per demo after
 * the page is interactive (a client effect / `onMounted` / module bottom). The
 * pre-paint {@link THEME_INIT_SCRIPT} has usually already set the attribute;
 * this re-applies defensively, injects the toggle, and keeps `system` mode
 * following the OS while no override is set.
 */
export function initTheme(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  pref = readPref();
  apply(pref);

  button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  button.addEventListener('click', cycle);
  render();
  document.body.append(button);

  // While in system mode (no override), track live OS theme changes.
  if (typeof matchMedia !== 'undefined') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (pref === 'system') apply(pref);
    });
  }
}
