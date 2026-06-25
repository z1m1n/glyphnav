/**
 * Solid-specific helpers shared by the Solid-family adapters (Solid Router and
 * TanStack Router/Solid). Not part of the public API — imported directly so the
 * provider/controller and link-click boilerplate is written once instead of
 * being re-implemented per adapter.
 */
import {
  createComponent,
  createContext,
  createRenderEffect,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js';
import type { JSX } from 'solid-js';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions } from '../core';
import { isModifiedClick } from './links';

export interface GlyphnavProviderProps extends GlyphnavOptions {
  children?: JSX.Element;
  /**
   * Also animate browser back/forward (popstate) traversals for the subtree.
   * Off by design — the adapter patches nothing globally until you opt in here.
   * @defaultValue `false`
   */
  animatePopState?: boolean;
}

/** A context-backed `<GlyphnavProvider>` plus the hook that reads it. */
export interface SolidControllerContext {
  /**
   * Provide a shared controller (and base options) to the subtree. Optional —
   * the hooks work without it, each creating their own controller.
   */
  GlyphnavProvider: (props: GlyphnavProviderProps) => JSX.Element;
  /** Get the controller from context, or a stable per-component fallback. */
  useGlyphnavController: (options?: GlyphnavOptions) => GlyphnavController;
}

/**
 * Build a context-backed provider/hook pair for a Solid adapter. Each adapter
 * calls this once at module load so the two adapters never share a single
 * controller context (mirrors how the React adapters each own their context).
 *
 * @returns The `<GlyphnavProvider>` and its `useGlyphnavController` reader.
 */
export const createSolidControllerContext = (): SolidControllerContext => {
  const GlyphnavContext = createContext<GlyphnavController | null>(null);

  const GlyphnavProvider = (props: GlyphnavProviderProps): JSX.Element => {
    const controller = new GlyphnavController();
    const [, options] = splitProps(props, ['children', 'animatePopState']);
    // Keep the base options in sync as the (reactive) provider props change.
    createRenderEffect(() => controller.update({ ...options }));
    // The flag is treated as static; wire the listener once and tear it down
    // with the provider.
    if (props.animatePopState) onCleanup(controller.enableHistoryAnimation());

    return createComponent(GlyphnavContext.Provider, {
      value: controller,
      get children() {
        return props.children;
      },
    });
  };

  // Solid component bodies run once, so a fresh controller here is already
  // stable for the component's lifetime — no ref needed.
  const useGlyphnavController = (options?: GlyphnavOptions): GlyphnavController =>
    useContext(GlyphnavContext) ?? new GlyphnavController(options);

  return { GlyphnavProvider, useGlyphnavController };
};

/** Solid's anchor click-event type (matches a `JSX.EventHandler` parameter). */
type SolidAnchorClick = Parameters<JSX.EventHandler<HTMLAnchorElement, MouseEvent>>[0];

/**
 * Shared click-handler body for the Solid adapter `<GlyphnavLink>`s: forward to
 * the caller's `onClick` first (Solid's plain-function or bound-tuple form), let
 * modified clicks (new tab, etc.) pass through to the browser, otherwise prevent
 * the default navigation and play the animation before committing via `commit`.
 *
 * @param event - The Solid mouse event being handled.
 * @param onClick - The caller's own click handler (function or bound tuple), run first.
 * @param controller - Controller that plays the animation and commits.
 * @param href - The resolved destination shown in the address bar.
 * @param commit - Performs the real navigation once the animation finishes.
 */
export const runSolidLinkClick = (
  event: SolidAnchorClick,
  onClick: JSX.AnchorHTMLAttributes<HTMLAnchorElement>['onClick'],
  controller: GlyphnavController,
  href: string,
  commit: () => void | Promise<void>,
): void => {
  if (Array.isArray(onClick)) onClick[0](onClick[1], event);
  else if (typeof onClick === 'function') onClick(event);

  if (isModifiedClick(event)) return; // let the browser handle modified clicks

  // `preventDefault` also stops Solid Router's delegated click handler, which
  // bails on an already-prevented event — so the navigation happens once.
  event.preventDefault();
  void controller.run(href, commit);
};
