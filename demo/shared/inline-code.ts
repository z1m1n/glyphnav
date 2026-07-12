/**
 * Syntax-highlight the small inline `<code>` chips scattered through demo prose —
 * the one-liners in headers, captions and footnotes — with the same sugar-high
 * pass the docs code blocks and the landing-page cards use.
 *
 * Framework-agnostic, like ./code-blocks and ./tooltip: a single
 * {@link initInlineCode} call (kicked off by {@link initCodeBlocks}) highlights
 * every inline chip on the page, and a MutationObserver re-highlights chips that
 * mount later (SPA route changes). Each processed chip is tagged `.hl` so re-runs
 * skip it and the stylesheet can swap the accent-tinted chip fill for the neutral
 * docs-block one (the `--sh-*` token palette is contrast-tuned against that fill,
 * not `--accent-fill` — same reason the cards do it). Idempotent and SSR-safe.
 *
 * Only *inline* chips are touched: anything inside a `<pre>` is a code block,
 * already highlighted where it's rendered. Chips are highlighted in place via
 * innerHTML. Some hosts (React with a shared route component) reuse the same
 * `<code>` element across routes and just reset its text — that cleanly replaces
 * our token spans with a plain text node (no reconciliation crash), so the
 * observer watches for a text reset on an existing chip and re-highlights it,
 * while a chip whose markup was clobbered is re-highlighted even though its `.hl`
 * flag lingers. Idempotent both ways.
 */

import { highlight } from './highlight';

/** Highlight every not-yet-processed inline `<code>` chip (skips code blocks). */
function enhance(): void {
  for (const code of document.querySelectorAll<HTMLElement>('code')) {
    if (code.closest('pre')) continue; // a code block, highlighted where rendered
    // Skip chips already highlighted whose markup is intact. If a host reused the
    // element across a route change and reset its text, the token spans are gone
    // (childElementCount 0) even though `.hl` lingers — re-highlight those.
    if (code.classList.contains('hl') && code.childElementCount > 0) continue;
    const text = code.textContent ?? '';
    if (!text.trim()) continue; // nothing to tokenize

    code.innerHTML = highlight(text);
    code.classList.add('hl');
  }
}

/** Whether `node` is, or contains, a `<code>` (cheap filter for the observer). */
function hasCode(node: Node): boolean {
  return (
    node.nodeType === 1 &&
    ((node as Element).matches?.('code') || !!(node as Element).querySelector?.('code'))
  );
}

/** Whether `node` is an inline `<code>` (or lives in one) — a chip reset in place. */
function isInlineCode(node: Node): boolean {
  const code = node.nodeType === 1 ? (node as Element).closest('code') : null;
  return !!code && !code.closest('pre');
}

let initialized = false;

/**
 * Highlight the page's inline code chips, and keep doing so as new ones mount.
 * Idempotent and SSR-safe — this runs from {@link initCodeBlocks} once the page
 * is interactive, so every demo that wires up code blocks gets its inline chips
 * highlighted too. A no-op on the server.
 */
export function initInlineCode(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  const run = (): void => {
    if (document.body) enhance();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  // Re-highlight when chips mount or are reset (SPA route changes). The per-frame
  // address-bar text updates mutate a plain <span class="path"> (never a chip),
  // so they match neither branch and schedule nothing.
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    // A microtask, not requestAnimationFrame: rAF is paused in hidden and
    // prerendered tabs (the demos are prefetched/prerendered), so a chip that
    // mounts there would stay un-highlighted until first paint. Microtasks always
    // run, and still coalesce a burst of mutations into a single pass.
    queueMicrotask(() => {
      scheduled = false;
      enhance();
    });
  };
  new MutationObserver((records) => {
    for (const r of records) {
      // A fresh subtree mounted carrying a chip (route add / full remount).
      for (const node of r.addedNodes) {
        if (hasCode(node)) {
          schedule();
          return;
        }
      }
      // An existing chip's text was reset in place (host reused the element) —
      // the chip is the mutation target, its new text an added text node hasCode
      // can't see.
      if (isInlineCode(r.target)) {
        schedule();
        return;
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}
