/**
 * Adapter for Astro's ClientRouter. Pass `navigate` from
 * `astro:transitions/client` into a bundled client script: Astro's virtual
 * modules are resolved by the app, so this entry also imports in plain Node.
 */
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { eligibleAnchor, reportNavigationError } from '../internal/links';

/** Options forwarded unchanged to Astro's `navigate`. */
export interface AstroNavigateOptions {
  /** Push a history entry (auto/push), or replace the current one. */
  history?: 'auto' | 'push' | 'replace';
  /** Data exposed to Astro's navigation lifecycle events. */
  info?: unknown;
  /** Data associated with the destination history entry. */
  state?: unknown;
  /** Send a POST navigation with this form data. */
  formData?: FormData;
  /** Element that triggered the navigation, exposed to lifecycle events. */
  sourceElement?: Element;
}

/** Astro's navigation function, typed without importing its virtual module. */
export type AstroNavigate = (href: string, options?: AstroNavigateOptions) => Promise<void>;

export interface AstroGlyphnavOptions extends GlyphnavOptions {
  /**
   * Animate eligible same-origin links globally, or only explicit calls to
   * the instance's `navigate` and links attached with `link`.
   * @defaultValue `'links'`
   */
  intercept?: 'links' | 'none';
  /** Animate browser back/forward on top of Astro's restored entry. */
  animatePopState?: boolean;
  /** Capture-phase listener root. Defaults to `document` on the client. */
  root?: Document | HTMLElement;
}

export interface AstroGlyphnavInstance {
  /** Controller for updating animation options or cancelling a run. */
  controller: GlyphnavController;
  /** Animated navigation, forwarding Astro's options and awaiting its promise. */
  navigate: (to: string | URL, options?: AstroNavigateOptions) => Promise<RunResult>;
  /** Attach animation to one anchor; returns its listener cleanup. */
  link: (node: HTMLAnchorElement) => () => void;
  /** Remove owned listeners and cancel pending animation/navigation waits. */
  detach: () => void;
}

/**
 * Attach once in a shared layout's bundled `<script>` alongside ClientRouter.
 * Bundled scripts run once across document swaps, so the document listener
 * keeps handling new anchors without reinstallation on `astro:page-load`.
 *
 * @example
 * ```ts
 * import { navigate } from 'astro:transitions/client';
 * import { attachGlyphnav } from 'glyphnav/astro';
 * const glyph = attachGlyphnav(navigate, { duration: 250 });
 * await glyph.navigate('/about/', { history: 'replace' });
 * ```
 */
export const attachGlyphnav = (
  astroNavigate: AstroNavigate,
  options: AstroGlyphnavOptions = {},
): AstroGlyphnavInstance => {
  const {
    intercept = 'links',
    animatePopState = false,
    root = typeof document !== 'undefined' ? document : undefined,
    ...glyph
  } = options;
  const controller = new GlyphnavController(glyph);
  const linkCleanups = new Set<() => void>();

  const navigate = (to: string | URL, extras?: AstroNavigateOptions): Promise<RunResult> => {
    // Relative targets must resolve against the real path, even if a previous
    // run currently owns the address bar. Cross-origin URLs stay unanimated.
    controller.cancel();
    const href = String(to);
    let path = href;
    if (typeof window !== 'undefined') {
      const url = new URL(href, window.location.href);
      if (url.origin === window.location.origin) path = url.pathname + url.search + url.hash;
    }
    return controller.run(path, () => astroNavigate(href, extras));
  };

  const onClick = ((event: MouseEvent): void => {
    const anchor = eligibleAnchor(event);
    // Astro's explicit hard-reload links must retain their native behavior.
    if (!anchor || anchor.hasAttribute('data-astro-reload')) return;
    // Resolve relative hrefs after restoring any in-flight scrambled path.
    controller.cancel();
    const href = anchor.href;
    const history = anchor.dataset.astroHistory === 'replace' ? 'replace' : 'auto';
    event.preventDefault();
    void navigate(href, { history, sourceElement: anchor }).catch(reportNavigationError);
  }) as EventListener;

  if (intercept === 'links') root?.addEventListener('click', onClick, true);
  if (animatePopState) controller.enableHistoryAnimation();

  return {
    controller,
    navigate,
    link(node) {
      node.addEventListener('click', onClick);
      const cleanup = (): void => {
        node.removeEventListener('click', onClick);
        linkCleanups.delete(cleanup);
      };
      linkCleanups.add(cleanup);
      return cleanup;
    },
    detach() {
      if (intercept === 'links') root?.removeEventListener('click', onClick, true);
      for (const cleanup of linkCleanups) cleanup();
      controller.destroy();
    },
  };
};
