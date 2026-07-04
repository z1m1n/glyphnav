/**
 * Framework switcher for the demo masthead.
 *
 * Each demo authors a ▾ disclosure button right after its breadcrumb —
 * "glyphnav / vue-router ▾". This module *finds* that button (it never creates
 * or injects it), builds a menu of every demo from the shared {@link DEMOS}
 * catalog, and toggles it — so you can hop straight to the same demo in another
 * framework without a round-trip through the picker. The menu itself is a
 * data-driven top-layer overlay (a native popover: light dismiss and Escape
 * handled by the browser), so — like the tooltip and theme-toggle helpers — it
 * is built in script rather than hand-authored 12× per demo. It's themed like
 * the controls toolbar; every item is a plain cross-demo anchor (a full page
 * load into a different app), marked `data-glyphnav="off"` so the
 * link-intercepting demos (vanilla, preact-iso, sveltekit) leave it to the
 * browser.
 *
 * Framework-agnostic by design (like demo/shared/tooltip.ts, whose popover
 * plumbing it shares via ./internal/popover) and self-wiring: the current demo
 * comes from the `.crumb` text and the site root from the masthead wordmark
 * link, so there's no per-demo configuration — call {@link initFwMenu} once
 * after the header is in the DOM (a client effect / `onMounted` / module
 * bottom) and dispose with the returned detach function when the host
 * unmounts. Idempotent and SSR-safe; a no-op on pages without the switcher
 * button (the changelog) and, like the tooltips, in browsers without the
 * Popover API.
 */
import { DEMOS } from './demos';
import { clamp, onViewportShift, supportsPopover, VIEWPORT_MARGIN } from './internal/popover';

/** The menu's id — matches the `aria-controls` on each demo's authored button. */
const MENU_ID = 'fw-menu';
/** Space between the breadcrumb and the opened menu. */
const GAP = 6;

/** Detach function handed back when there was nothing to wire. */
const noop = (): void => {};

let initialized = false;

/**
 * Position the menu under the breadcrumb, clamped into the viewport (flipping
 * above when there's no room below). Coordinates are viewport-relative — the
 * menu is `position: fixed` in the top layer.
 */
function place(anchor: HTMLElement, menu: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  let top = a.bottom + GAP;
  if (top + m.height > vh - VIEWPORT_MARGIN) {
    top = clamp(a.top - m.height - GAP, VIEWPORT_MARGIN, vh - m.height - VIEWPORT_MARGIN);
  }
  const left = clamp(a.left, VIEWPORT_MARGIN, vw - m.width - VIEWPORT_MARGIN);

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}

/**
 * Build the popover menu — one link per demo, the current one marked. A
 * `<span>` so the markup stays valid inside the `<h1>`; the stylesheet resets
 * it to a block panel while open.
 */
function buildMenu(root: string, current: string): HTMLSpanElement {
  const menu = document.createElement('span');
  menu.id = MENU_ID;
  menu.className = 'fw-menu';
  menu.setAttribute('popover', ''); // auto: light dismiss + Escape are native

  for (const { name, fw } of DEMOS) {
    const item = document.createElement('a');
    item.href = `${root}${name}/`;
    item.textContent = name;
    // Keys the item's framework icon (a stylesheet background per [data-fw]).
    item.dataset.fw = fw;
    // Cross-demo link: the intercepting demos must let the browser load it.
    item.dataset.glyphnav = 'off';
    if (name === current) item.setAttribute('aria-current', 'page');
    menu.append(item);
  }
  return menu;
}

/**
 * Wire the framework switcher. Idempotent and SSR-safe — call once per demo
 * after the masthead exists in the DOM (a client effect / `onMounted` /
 * module bottom). Finds the `.fw-switch` button the demo authored after its
 * breadcrumb, builds the menu from the shared {@link DEMOS} catalog (site root
 * from the wordmark link, current demo from the `.crumb` text), inserts it
 * right after the button so keyboard focus flows into it, and toggles it.
 *
 * @returns A detach function that removes the built menu and every listener —
 *   return it from the host's unmount hook. A no-op when there's nothing to
 *   wire (no switcher button, or no Popover API).
 */
export function initFwMenu(): () => void {
  if (initialized || typeof document === 'undefined' || !supportsPopover()) return noop;

  const button = document.querySelector<HTMLButtonElement>('.fw-switch');
  const crumb = document.querySelector<HTMLElement>('h1 .crumb');
  // Pages that author no switcher button (the changelog) leave nothing to do.
  if (!button || !crumb) return noop;
  initialized = true;

  // The wordmark link already points at the site root in every demo ('/' in
  // dev, '/glyphnav/' deployed, and the Next/Nuxt/SvelteKit equivalents).
  const root = document.querySelector('h1 a')?.getAttribute('href') ?? '/';
  const menu = buildMenu(root, crumb.textContent?.trim() ?? '');
  // The menu is the only node we add — right after the authored button, so
  // keyboard focus flows button → items.
  button.after(menu);

  // One controller unhooks every listener below (including the viewport ones)
  // on detach.
  const controller = new AbortController();
  const { signal } = controller;

  // The toggle is wired by hand (not `popovertarget`): showing manually lets
  // the menu be measured and placed in the same task as showPopover(), before
  // the browser paints the UA default (centred) position. The cost is losing
  // the invoker's light-dismiss exemption — pressing the button while the menu
  // is open dismisses it on pointerdown, and the click that follows would
  // immediately reopen it. `wasOpen` (sampled at pointerdown) breaks that loop;
  // keyboard activation fires no pointerdown and just toggles.
  let wasOpen = false;
  button.addEventListener(
    'pointerdown',
    () => {
      wasOpen = menu.matches(':popover-open');
    },
    { signal },
  );
  button.addEventListener(
    'click',
    () => {
      if (wasOpen) {
        wasOpen = false;
        return;
      }
      if (menu.matches(':popover-open')) {
        menu.hidePopover();
      } else {
        menu.showPopover();
        place(crumb, menu);
      }
    },
    { signal },
  );

  // One sync point for every way the menu opens or closes (button, Escape,
  // light dismiss, link navigation).
  menu.addEventListener(
    'toggle',
    () => {
      button.setAttribute('aria-expanded', String(menu.matches(':popover-open')));
    },
    { signal },
  );

  // Keep an open menu pinned to the breadcrumb when the page shifts under it.
  onViewportShift(() => {
    if (menu.matches(':popover-open')) place(crumb, menu);
  }, signal);

  return () => {
    controller.abort();
    menu.remove();
    button.setAttribute('aria-expanded', 'false');
    initialized = false;
  };
}
