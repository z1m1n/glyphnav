/**
 * React-specific helpers shared by the React-family adapters (React Router,
 * TanStack Router/React, Next.js). Not part of the public API — imported
 * directly so the controller-lifecycle and link-click boilerplate is written
 * once instead of being re-implemented per adapter.
 */
import { createContext, createElement, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions } from '../core';
import { eligibleAnchor, reportNavigationError } from './links';
import type { ClickModifiers } from './links';

export interface GlyphnavProviderProps extends GlyphnavOptions {
  children: ReactNode;
  /**
   * Also animate browser back/forward (popstate) traversals for the subtree.
   * Off by design — the adapter patches nothing globally until you opt in here.
   * @defaultValue `false`
   */
  animatePopState?: boolean;
}

/** A context-backed `<GlyphnavProvider>` plus the hook that reads it. */
export interface ReactControllerContext {
  /**
   * Provide a shared controller (and base options) to the subtree. Optional —
   * the hooks work without it, each creating their own controller.
   */
  GlyphnavProvider: (props: GlyphnavProviderProps) => ReactNode;
  /** Get the controller from context, or a stable per-component fallback. */
  useGlyphnavController: (options?: GlyphnavOptions) => GlyphnavController;
}

/**
 * Build a context-backed provider/hook pair for a React adapter. Each adapter
 * calls this once at module load so the adapters never share a single
 * controller context. (Next.js keeps its own context — it also carries the
 * router mode and base path — so it does not use this.)
 *
 * @returns The `<GlyphnavProvider>` and its `useGlyphnavController` reader.
 */
export const createControllerContext = (): ReactControllerContext => {
  const GlyphnavContext = createContext<GlyphnavController | null>(null);

  const GlyphnavProvider = ({
    children,
    animatePopState = false,
    ...options
  }: GlyphnavProviderProps): ReactNode => {
    const controller = useSharedController(options);
    useHistoryAnimation(controller, animatePopState);

    return createElement(GlyphnavContext.Provider, { value: controller }, children);
  };

  const useGlyphnavController = (options?: GlyphnavOptions): GlyphnavController => {
    const fromContext = useContext(GlyphnavContext);
    const fallback = useFallbackController(!fromContext, options);

    return fromContext ?? (fallback as GlyphnavController);
  };

  return { GlyphnavProvider, useGlyphnavController };
};

/**
 * The controller behind a `<GlyphnavProvider>`: created once and re-`update()`d
 * with the latest base options on every render so option changes take effect
 * without tearing down the controller.
 *
 * @param options - Base options to apply to the shared controller.
 * @returns The stable provider controller.
 */
export const useSharedController = (options: GlyphnavOptions): GlyphnavController => {
  const [controller] = useState(() => new GlyphnavController(options));
  controller.update(options);
  useEffect(() => () => controller.destroy(), [controller]);

  return controller;
};

/**
 * A stable per-component controller, constructed only when `enabled` (i.e. no
 * provider is in scope). Returns `null` when disabled so callers can prefer the
 * context controller via `??` without ever building a throwaway one.
 *
 * @param enabled - Build a fallback controller only when `true`.
 * @param options - Base options for the fallback controller.
 * @returns The fallback controller, or `null` when `enabled` is `false`.
 * A fallback owns no global listeners and may finish a navigation after its
 * source component unmounts. Providers own and destroy their shared controller.
 */
export const useFallbackController = (
  enabled: boolean,
  options?: GlyphnavOptions,
): GlyphnavController | null => {
  const [controller, setController] = useState<GlyphnavController | null>(null);
  if (enabled && controller === null) {
    const fallback = new GlyphnavController(options);
    setController(fallback);
    return fallback;
  }

  if (enabled) controller?.update(options ?? {});

  return controller;
};

/**
 * Wire {@link GlyphnavController.enableHistoryAnimation} to a provider's
 * lifetime: attach the popstate listener while `enabled`, detach on unmount or
 * when the controller/flag changes. A no-op when `enabled` is `false`, so the
 * per-link adapters stay global-patch-free until a provider opts in.
 *
 * @param controller - The provider's shared controller.
 * @param enabled - Whether back/forward (popstate) traversals should animate.
 */
export const useHistoryAnimation = (controller: GlyphnavController, enabled: boolean): void => {
  useEffect(() => {
    if (enabled) return controller.enableHistoryAnimation();
  }, [controller, enabled]);
};

/**
 * Shared click-handler body for the adapter `<GlyphnavLink>`s: run the caller's
 * `onClick`, let modified clicks (new tab, etc.) pass through to the browser,
 * otherwise prevent the default navigation and follow the controller's
 * configured commit timing. By default navigation precedes the animation.
 *
 * @param event - The (React-synthetic) mouse event being handled.
 * @param onClick - The caller's own click handler, run first.
 * @param controller - Controller that plays the animation and commits.
 * @param href - The resolved destination shown in the address bar.
 * @param commit - Performs the real navigation at the configured point.
 */
export const runLinkClick = <
  E extends ClickModifiers & {
    preventDefault: () => void;
    target: EventTarget | null;
    currentTarget: HTMLAnchorElement;
  },
>(
  event: E,
  onClick: ((event: E) => void) | undefined,
  controller: GlyphnavController,
  href: string,
  commit: (signal: AbortSignal) => void | Promise<void>,
  glyphOptions?: GlyphnavOptions,
): void => {
  onClick?.(event);
  if (!eligibleAnchor(event, event.currentTarget)) return;

  event.preventDefault();
  void controller.run(href, commit, glyphOptions).catch(reportNavigationError);
};
