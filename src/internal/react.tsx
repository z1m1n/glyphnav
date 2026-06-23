/**
 * React-specific helpers shared by the React-family adapters (React Router,
 * TanStack Router/React, Next.js). Not part of the public API — imported
 * directly so the controller-lifecycle and link-click boilerplate is written
 * once instead of being re-implemented per adapter.
 */
import { useRef } from 'react';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions } from '../core';
import { isModifiedClick } from './links';
import type { ClickModifiers } from './links';

/**
 * The controller behind a `<GlyphnavProvider>`: created once and re-`update()`d
 * with the latest base options on every render so option changes take effect
 * without tearing down the controller.
 *
 * @param options - Base options to apply to the shared controller.
 * @returns The stable provider controller.
 */
export const useSharedController = (options: GlyphnavOptions): GlyphnavController => {
  const ref = useRef<GlyphnavController | null>(null);
  if (ref.current) ref.current.update(options);
  else ref.current = new GlyphnavController(options);

  return ref.current;
};

/**
 * A stable per-component controller, constructed only when `enabled` (i.e. no
 * provider is in scope). Returns `null` when disabled so callers can prefer the
 * context controller via `??` without ever building a throwaway one.
 *
 * @param enabled - Build a fallback controller only when `true`.
 * @param options - Base options for the fallback controller.
 * @returns The fallback controller, or `null` when `enabled` is `false`.
 */
export const useFallbackController = (
  enabled: boolean,
  options?: GlyphnavOptions,
): GlyphnavController | null => {
  const ref = useRef<GlyphnavController | null>(null);
  if (enabled && !ref.current) ref.current = new GlyphnavController(options);

  return ref.current;
};

/**
 * Shared click-handler body for the adapter `<GlyphnavLink>`s: run the caller's
 * `onClick`, let modified clicks (new tab, etc.) pass through to the browser,
 * otherwise prevent the default navigation and play the animation before
 * committing the real navigation via `commit`.
 *
 * @param event - The (React-synthetic) mouse event being handled.
 * @param onClick - The caller's own click handler, run first.
 * @param controller - Controller that plays the animation and commits.
 * @param href - The resolved destination shown in the address bar.
 * @param commit - Performs the real navigation once the animation finishes.
 */
export const runLinkClick = <E extends ClickModifiers & { preventDefault: () => void }>(
  event: E,
  onClick: ((event: E) => void) | undefined,
  controller: GlyphnavController,
  href: string,
  commit: () => void | Promise<void>,
): void => {
  onClick?.(event);
  if (isModifiedClick(event)) return; // let the browser handle modified clicks

  event.preventDefault();
  void controller.run(href, commit);
};
