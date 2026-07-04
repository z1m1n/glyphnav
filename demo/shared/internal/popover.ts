/**
 * Primitives shared by the popover-based demo widgets — the toolbar tooltips
 * (demo/shared/tooltip.ts) and the masthead framework menu
 * (demo/shared/fw-menu.ts). Both render into the browser top layer via the
 * native Popover API and keep themselves pinned to an anchor element, so they
 * share the feature guard, the viewport-clamping maths and the "reposition
 * when the page shifts" window wiring. Internal — not part of the
 * `@glyphnav-demo/shared` barrel.
 */

/** Minimum inset kept when clamping a floating box into the viewport. */
export const VIEWPORT_MARGIN = 8;

/** Whether the browser has the native Popover API (SSR-safe check). */
export const supportsPopover = (): boolean =>
  typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.showPopover;

/** Clamp `value` into [min, max]. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/**
 * Run `handler` whenever the viewport shifts under an open popover — any
 * scroll (capture phase, so scrolling nested containers counts too) or a
 * window resize. Pass an `AbortSignal` to drop both listeners on abort;
 * widgets that live for the whole page (e.g. the tooltips) can omit it.
 */
export function onViewportShift(handler: () => void, signal?: AbortSignal): void {
  window.addEventListener('scroll', handler, { capture: true, signal });
  window.addEventListener('resize', handler, { signal });
}
