/**
 * Styled, top-layer tooltips for the demo toolbar controls.
 *
 * The controls used to carry a native `title`, whose tooltip can't be themed,
 * lags ~half a second before it appears and vanishes the moment the pointer
 * twitches. This swaps that for a single popover element — rendered in the
 * browser top layer via the native Popover API, so it escapes the toolbar's
 * overflow and stacking context — that fades in, *glides* between adjacent
 * controls, and fades out, all themed with the demo's design tokens.
 *
 * Framework-agnostic by design: every demo marks its toolbar labels with
 * `data-tip="…"` and calls {@link initTooltips} once. One popover serves the
 * whole page, and showing is driven by delegated pointer/focus listeners on
 * `document`, so it keeps working across any re-render the host framework
 * performs. The `title` text lives in `CONTROL_TOOLTIPS` (see ./content).
 */

import { clamp, onViewportShift, supportsPopover, VIEWPORT_MARGIN } from './internal/popover';

/** Shared id, so the active control can point at the tip via `aria-describedby`. */
const TIP_ID = 'glyph-tip';
/** Delay before a cold tooltip appears — long enough to ignore a passing sweep. */
const SHOW_DELAY = 140;
/** Grace before hiding, so crossing the gap between controls glides, not flickers. */
const HIDE_DELAY = 110;
/** Space between the control and the tip — leaves room for the arrow. */
const GAP = 10;

/** The one popover element, lazily built on first show. */
let tip: HTMLDivElement | null = null;
/** The `[data-tip]` element the tip currently describes (drives glide + a11y). */
let anchor: HTMLElement | null = null;
/** The target a pending cold-show is counting down for. */
let pending: HTMLElement | null = null;
let showTimer = 0;
let hideTimer = 0;
let initialized = false;

/** Build the popover once and append it to the body. */
function build(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = TIP_ID;
  el.className = 'glyph-tooltip';
  // `manual`: never light-dismisses — we own show/hide entirely.
  el.setAttribute('popover', 'manual');
  el.setAttribute('role', 'tooltip');
  document.body.append(el);
  return el;
}

/**
 * Position `el` against `target`: above the control by preference (flipping
 * below when there's no room), centred and clamped into the viewport, with the
 * arrow tracking the control's centre even after the box is clamped. Coordinates
 * are viewport-relative — the tip is `position: fixed` in the top layer.
 */
function place(target: HTMLElement, el: HTMLElement): void {
  const a = target.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // Prefer above the control; flip below when it would clip the top edge.
  let top = a.top - t.height - GAP;
  const below = top < VIEWPORT_MARGIN;
  if (below) top = a.bottom + GAP;
  top = clamp(top, VIEWPORT_MARGIN, vh - t.height - VIEWPORT_MARGIN);

  // Centre over the control, then clamp horizontally into the viewport.
  const centre = a.left + a.width / 2;
  const left = clamp(centre - t.width / 2, VIEWPORT_MARGIN, vw - t.width - VIEWPORT_MARGIN);

  // The arrow stays pointed at the control even after the box is clamped.
  const arrow = clamp(centre - left, GAP, t.width - GAP);

  el.classList.toggle('is-below', below);
  el.style.setProperty('--tip-arrow', `${arrow}px`);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

/** Show the tip for `target` (no delay): fades in cold, glides when already open. */
function open(target: HTMLElement): void {
  const text = target.dataset.tip;
  if (!text) return;

  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  showTimer = hideTimer = 0;
  pending = null;

  const el = tip ?? (tip = build());
  const wasOpen = el.matches(':popover-open');
  el.textContent = text;

  if (anchor && anchor !== target) anchor.removeAttribute('aria-describedby');
  anchor = target;
  target.setAttribute('aria-describedby', TIP_ID);

  if (wasOpen) {
    // Already visible: just reposition — the CSS transition glides top/left over.
    place(target, el);
  } else {
    // Cold start: show first so it has dimensions in the top layer, then position
    // synchronously in the same frame. top/left carry no @starting-style, so they
    // snap into place while only opacity/transform animate in.
    el.showPopover();
    place(target, el);
  }
}

/** Hide the tip and clear all pending state. */
function close(): void {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  showTimer = hideTimer = 0;
  pending = null;
  if (anchor) {
    anchor.removeAttribute('aria-describedby');
    anchor = null;
  }
  if (tip?.matches(':popover-open')) tip.hidePopover();
}

/** Hover/focus entered `target`: glide if open, else arm the cold-show timer. */
function scheduleShow(target: HTMLElement): void {
  clearTimeout(hideTimer);
  hideTimer = 0;
  if (tip?.matches(':popover-open')) {
    if (anchor !== target) open(target);
    return;
  }
  // Already counting down for this control — let the timer run (pointer moves
  // within a label fire `pointerover` repeatedly; don't keep resetting it).
  if (showTimer && pending === target) return;
  clearTimeout(showTimer);
  pending = target;
  showTimer = window.setTimeout(() => open(target), SHOW_DELAY);
}

/** Hover/focus left a control: arm the hide timer, cancelled if we re-enter one. */
function scheduleHide(): void {
  clearTimeout(showTimer);
  showTimer = 0;
  pending = null;
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(close, HIDE_DELAY);
}

const tipOf = (node: EventTarget | null): HTMLElement | null =>
  node instanceof Element ? node.closest<HTMLElement>('[data-tip]') : null;

/**
 * Wire the toolbar tooltips. Idempotent and SSR-safe — call it once per demo
 * after the page is interactive (a client effect / `onMounted` / module bottom).
 * Does nothing in browsers without the Popover API, leaving the controls usable.
 */
export function initTooltips(): void {
  if (initialized || typeof document === 'undefined') return;
  if (!supportsPopover()) return;
  initialized = true;

  // Delegated on `document` so any framework re-render of the toolbar is fine.
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return; // hover tips don't apply to taps
    const target = tipOf(e.target);
    if (target) scheduleShow(target);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const from = tipOf(e.target);
    // Ignore moves that stay within the same control (label ↔ its select/input).
    if (from && tipOf(e.relatedTarget) !== from) scheduleHide();
  });

  // Keyboard parity: focusing a control shows its tip at once; blurring hides it.
  document.addEventListener('focusin', (e) => {
    const target = tipOf(e.target);
    if (target) open(target);
  });
  document.addEventListener('focusout', (e) => {
    if (tipOf(e.target)) scheduleHide();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Keep a shown tip pinned to its control when the page shifts under it.
  // Tooltips live for the whole page, so the detach function goes unused.
  onViewportShift(() => {
    if (anchor && tip?.matches(':popover-open')) place(anchor, tip);
  });
}
