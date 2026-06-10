/**
 * Adapter for React Router (v6+).
 *
 *  - `<GlyphnavProvider>` shares a single controller across the tree (optional).
 *  - `useGlyphnavNavigate()` is a drop-in for `useNavigate()` that animates first.
 *  - `<GlyphnavLink>` is a drop-in for `<Link>` that animates on click.
 *
 * Nothing is patched globally: only navigations made through these entry
 * points animate.
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useRef,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  Link,
  useHref,
  useNavigate,
  type LinkProps,
  type NavigateOptions,
  type To,
} from 'react-router-dom';
import { GlyphnavController, type GlyphnavOptions, type RunResult } from '../core';

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (to: To | number, options?: NavigateOptions) => Promise<RunResult>;

const GlyphnavContext = createContext<GlyphnavController | null>(null);

function toPathString(to: To): string {
  if (typeof to === 'string') return to;
  return (to.pathname ?? '') + (to.search ?? '') + (to.hash ?? '');
}

export interface GlyphnavProviderProps extends GlyphnavOptions {
  children: ReactNode;
}

/**
 * Provide a shared controller (and base options) to the subtree. Optional —
 * the hooks work without it, each creating their own controller.
 */
export function GlyphnavProvider({ children, ...options }: GlyphnavProviderProps) {
  const ref = useRef<GlyphnavController | null>(null);
  if (!ref.current) ref.current = new GlyphnavController(options);
  else ref.current.update(options);
  return createElement(GlyphnavContext.Provider, { value: ref.current }, children);
}

/** Get the controller from context, or a stable per-component fallback. */
export function useGlyphnavController(options?: GlyphnavOptions): GlyphnavController {
  const fromContext = useContext(GlyphnavContext);
  const ref = useRef<GlyphnavController | null>(null);
  if (fromContext) return fromContext;
  if (!ref.current) ref.current = new GlyphnavController(options);
  return ref.current;
}

/**
 * A `useNavigate()` replacement that plays the glyph animation before
 * navigating. A numeric `to` (history delta) is passed straight through.
 */
export function useGlyphnavNavigate(options?: GlyphnavOptions): GlyphnavNavigateFn {
  const navigate = useNavigate();
  const controller = useGlyphnavController(options);

  return useCallback<GlyphnavNavigateFn>(
    (to, navOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return Promise.resolve<RunResult>('skipped');
      }
      const target = toPathString(to);
      return controller.run(target, () => {
        navigate(to, navOptions);
      });
    },
    [navigate, controller],
  );
}

export interface GlyphnavLinkProps extends LinkProps {
  /** Per-link option overrides. */
  glyphOptions?: GlyphnavOptions;
}

/**
 * Drop-in replacement for React Router's `<Link>` that animates on click.
 * Modified clicks (new tab, etc.) fall through to the browser as usual.
 */
export function GlyphnavLink({ to, onClick, replace, state, glyphOptions, ...rest }: GlyphnavLinkProps) {
  const navigate = useNavigate();
  const controller = useGlyphnavController(glyphOptions);
  // `useHref` resolves `to` to a basename-aware path, so the animated bar
  // matches what React Router actually navigates to.
  const href = useHref(to);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return; // let the browser handle modified clicks
      }
      event.preventDefault();
      void controller.run(href, () => {
        navigate(to, { replace, state });
      });
    },
    [onClick, controller, navigate, href, to, replace, state],
  );

  return createElement(Link, { to, onClick: handleClick, replace, state, ...rest });
}
