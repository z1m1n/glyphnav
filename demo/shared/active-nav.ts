/**
 * Active state for the demo nav rows, in two tiers.
 *
 * Every demo renders the same two rows — the page tabs (`nav.tabs`) and the
 * deep-link chips (`nav.deep`) — but each router's own "active link" logic
 * ignores the query and hash, so the deep-link chips could never light up at
 * all. This helper replaces ten router-specific approximations with one rule
 * shared by every demo:
 *
 *  - a page tab is current when its PATHNAME matches the address bar's
 *    (trailing slash ignored; a query/hash doesn't demote the page you're
 *    on) — it carries `aria-current="page"`;
 *  - a deep-link chip is current only on an EXACT full-URL match — pathname +
 *    query + hash — and carries the generic `aria-current="true"`, since the
 *    tab beside it already claims "page".
 *
 * So `/about?ref=deep&page=2` lights the "About" tab AND its own `?query`
 * chip; plain `/about` lights the tab alone. The stylesheet renders any
 * `[aria-current]` as the filled chip, so the semantics and the visuals are
 * the same fact.
 *
 * Framework-agnostic by design, like ./fw-menu and ./tooltip: anchors are
 * compared through the DOM (`a.href` is already base-resolved by whichever
 * router built it), so there's nothing per-framework to configure. The state
 * re-syncs from three directions:
 *  - `glyphnavOptions()` (./content) calls {@link syncActiveNav} from its
 *    `onComplete` hook, so the pill locks in exactly when the animated URL
 *    finishes resolving;
 *  - {@link initActiveNav} listens for popstate/hashchange, covering
 *    traversals that bypass the animation (the back/forward checkbox off);
 *  - a MutationObserver re-asserts the attribute when a framework re-renders
 *    an anchor and patches `aria-current` itself (vue-router and NuxtLink bind
 *    it to their own query-blind notion of "exactly active").
 */

/** Anchors owned by the two demo nav rows — never the fw-menu or the footer. */
const LINKS = 'nav.tabs a, nav.deep a';

/** The nav containers the re-render observer watches. */
const NAVS = 'nav.tabs, nav.deep';

/** Detach function handed back when there was nothing to wire. */
const noop = (): void => {};

let initialized = false;

/** `/vanilla/about/` and `/vanilla/about` are one page; the root keeps its slash. */
const normalize = (pathname: string): string => pathname.replace(/\/+$/, '') || '/';

/**
 * One pass: mark each nav link per its tier — page tabs on a pathname match,
 * deep-link chips on an exact pathname + query + hash match — and unmark the
 * rest. Safe to call any time; a no-op during SSR and on pages without the
 * nav rows.
 */
export function syncActiveNav(): void {
  if (typeof document === 'undefined') return;

  const herePath = normalize(location.pathname);
  const here = herePath + location.search + location.hash;
  for (const a of document.querySelectorAll<HTMLAnchorElement>(LINKS)) {
    const chip = a.closest('nav.deep') !== null;
    const active =
      a.origin === location.origin &&
      (chip
        ? normalize(a.pathname) + a.search + a.hash === here
        : normalize(a.pathname) === herePath);
    const mark = chip ? 'true' : 'page';
    // Write only on a real change: the MutationObserver in initActiveNav
    // watches this attribute, and idempotent writes are what keep the
    // observe → sync → observe cycle from feeding itself.
    if (active && a.getAttribute('aria-current') !== mark) {
      a.setAttribute('aria-current', mark);
    } else if (!active && a.hasAttribute('aria-current')) {
      a.removeAttribute('aria-current');
    }
  }
}

/**
 * Keep the nav rows' active state exact for the page's lifetime: an initial
 * pass now, popstate + hashchange listeners for traversals the animation
 * doesn't drive, and a MutationObserver that re-asserts the attribute after a
 * framework re-render touches the anchors. Idempotent and SSR-safe — call once
 * per demo after the nav is in the DOM (a client effect / `onMounted` / module
 * bottom) and dispose with the returned detach function when the host
 * unmounts.
 *
 * @returns A detach function removing the listeners and the observer.
 */
export function initActiveNav(): () => void {
  if (initialized || typeof document === 'undefined') return noop;
  initialized = true;

  syncActiveNav();

  const controller = new AbortController();
  const { signal } = controller;
  window.addEventListener('popstate', syncActiveNav, { signal });
  window.addEventListener('hashchange', syncActiveNav, { signal });

  const observer = new MutationObserver(syncActiveNav);
  for (const nav of document.querySelectorAll(NAVS)) {
    observer.observe(nav, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-current', 'href'],
    });
  }

  return () => {
    controller.abort();
    observer.disconnect();
    initialized = false;
  };
}
