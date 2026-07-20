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
 * The active chip moves the instant you click — not when the animated URL
 * finishes resolving. A click sets an OPTIMISTIC target ({@link pendingHref})
 * from the clicked link, so the state snaps over immediately even though the
 * address bar is still decoding (navigate-first) or hasn't moved at all
 * (animate-first). That target pins the state through the whole in-flight
 * animation — including the observer re-assert below — until the real location
 * catches up, when the address bar becomes authoritative again.
 *
 * Framework-agnostic by design, like ./fw-menu and ./tooltip: anchors are
 * compared through the DOM (`a.href` is already base-resolved by whichever
 * router built it), so there's nothing per-framework to configure. The target
 * is confirmed / corrected from three more directions:
 *  - `glyphnavOptions()` (./content) calls {@link syncActiveNav} from its
 *    `onComplete` hook, so the settled URL is reconciled when it resolves;
 *  - {@link initActiveNav} listens for popstate/hashchange, so browser
 *    traversals (back/forward) take over from any optimistic guess;
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

/**
 * The URL the nav should reflect while a click-driven navigation is in flight,
 * set optimistically on click so the active chip snaps over at once — before
 * the animated address bar finishes (navigate-first) or the navigation commits
 * (animate-first). `null` once the real location has caught up (or a browser
 * traversal takes over), when the live address bar is authoritative again.
 */
let pendingHref: string | null = null;

/** `/vanilla/about/` and `/vanilla/about` are one page; the root keeps its slash. */
const normalize = (pathname: string): string => pathname.replace(/\/+$/, '') || '/';

/** pathname + search + hash of the live address bar. */
const currentHref = (): string => location.pathname + location.search + location.hash;

/** Same page + query + hash, trailing slash ignored. */
function sameUrl(a: string, b: string): boolean {
  const ua = new URL(a, location.href);
  const ub = new URL(b, location.href);
  return (
    normalize(ua.pathname) + ua.search + ua.hash === normalize(ub.pathname) + ub.search + ub.hash
  );
}

/**
 * One pass: mark each nav link per its tier — page tabs on a pathname match,
 * deep-link chips on an exact pathname + query + hash match — and unmark the
 * rest, against the optimistic {@link pendingHref} while a click-driven
 * navigation is in flight, else the live address bar. Safe to call any time; a
 * no-op during SSR and on pages without the nav rows.
 */
export function syncActiveNav(): void {
  if (typeof document === 'undefined') return;

  // Once the address bar reaches the optimistic target, drop it — the live
  // location is authoritative again, so later traversals aren't pinned here.
  if (pendingHref !== null && sameUrl(pendingHref, currentHref())) {
    pendingHref = null;
  }

  const ref = new URL(pendingHref ?? currentHref(), location.href);
  const refPath = normalize(ref.pathname);
  const refFull = refPath + ref.search + ref.hash;

  for (const a of document.querySelectorAll<HTMLAnchorElement>(LINKS)) {
    const chip = a.closest('nav.deep') !== null;
    const active =
      a.origin === location.origin &&
      (chip
        ? normalize(a.pathname) + a.search + a.hash === refFull
        : normalize(a.pathname) === refPath);
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
 * Optimistically point the nav at a clicked link's target, so the active chip
 * moves the instant you click. Runs in the capture phase, ahead of the router
 * (and of adapters like preact-iso that `stopPropagation` in the bubble), and
 * only reads the href — it never calls `preventDefault`, leaving the actual
 * navigation to the demo's router.
 */
function onNavClick(event: MouseEvent): void {
  // Modified / non-primary clicks open a new context; the current page — and
  // so the active chip — stays put.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const a = (event.target as Element | null)?.closest<HTMLAnchorElement>(LINKS);
  if (!a || a.origin !== location.origin) return;
  pendingHref = a.pathname + a.search + a.hash;
  syncActiveNav();
}

/** A browser traversal (back/forward, hash) is authoritative — location wins. */
function onTraversal(): void {
  pendingHref = null;
  syncActiveNav();
}

/**
 * Keep the nav rows' active state exact for the page's lifetime: an initial
 * pass now, an optimistic capture-phase click handler that snaps the chip over
 * immediately, popstate + hashchange listeners for browser traversals, and a
 * MutationObserver that re-asserts the attribute after a framework re-render
 * touches the anchors. Idempotent and SSR-safe — call once per demo after the
 * nav is in the DOM (a client effect / `onMounted` / module bottom) and
 * dispose with the returned detach function when the host unmounts.
 *
 * @returns A detach function removing the listeners and the observer.
 */
export function initActiveNav(): () => void {
  if (initialized || typeof document === 'undefined') return noop;
  initialized = true;

  syncActiveNav();

  const controller = new AbortController();
  const { signal } = controller;
  document.addEventListener('click', onNavClick, { capture: true, signal });
  window.addEventListener('popstate', onTraversal, { signal });
  window.addEventListener('hashchange', onTraversal, { signal });

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
    pendingHref = null;
    initialized = false;
  };
}
