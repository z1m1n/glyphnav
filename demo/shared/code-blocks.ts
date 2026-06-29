/**
 * Copy-to-clipboard buttons for every docs code block, plus package-manager
 * tabs (npm / pnpm / yarn / bun / deno) on the install command.
 *
 * Framework-agnostic by design, like ./tooltip: every demo calls
 * {@link initCodeBlocks} once, a MutationObserver re-applies the enhancements to
 * any `<pre>` that mounts later (SPA route changes, the changelog's
 * runtime-rendered markdown), and clicks are handled by delegation on
 * `document` so they keep working across host-framework re-renders.
 *
 * The injected controls are appended *inside* each `<pre>` — never as a sibling
 * a framework owns, and the pre is never moved or wrapped — so React/Vue/Angular
 * reconciliation can't trip over a node it didn't create. If a block is fully
 * recreated (route remount), the observer re-enhances the fresh `<pre>`.
 * Idempotent and SSR-safe.
 */

import { DOCS_INSTALL } from './content';

/** A package manager offered by the install tabs, and how it spells `install`. */
interface PackageManager {
  /** The id shown on the tab and persisted (`'npm'`, `'pnpm'`, …). */
  id: string;
  /** Build the install line for a package name (e.g. `npm install glyphnav`). */
  cmd: (pkg: string) => string;
}

/** Package managers offered by the install tabs, in display order. */
const PACKAGE_MANAGERS: readonly PackageManager[] = [
  { id: 'npm', cmd: (pkg) => `npm install ${pkg}` },
  { id: 'pnpm', cmd: (pkg) => `pnpm add ${pkg}` },
  { id: 'yarn', cmd: (pkg) => `yarn add ${pkg}` },
  { id: 'bun', cmd: (pkg) => `bun add ${pkg}` },
  { id: 'deno', cmd: (pkg) => `deno add npm:${pkg}` },
];

/**
 * The package to install — the last token of the shared install command
 * (`pnpm add glyphnav` → `glyphnav`), so the tabs track the package name even if
 * {@link DOCS_INSTALL} ever changes.
 */
const PACKAGE = DOCS_INSTALL.trim().split(/\s+/).pop() ?? 'glyphnav';

/** localStorage key for the chosen package manager — shared across demos/pages. */
const PM_KEY = 'glyphnav-demo:pm';
/** Tab selected before any saved choice; matches {@link DOCS_INSTALL}. */
const DEFAULT_PM = 'pnpm';

/** How long the copy button shows its "copied" checkmark before reverting. */
const COPIED_MS = 1600;

// Inline icons — stroke-only so they inherit the button's `color` (and the green
// `--ok` it flips to on success). 24×24 viewBox; sized down by CSS.
const COPY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** Read the saved package manager, falling back to {@link DEFAULT_PM}. */
function loadPm(): string {
  try {
    const v = localStorage.getItem(PM_KEY);
    return v && PACKAGE_MANAGERS.some((p) => p.id === v) ? v : DEFAULT_PM;
  } catch {
    return DEFAULT_PM;
  }
}

/** Persist the chosen package manager. No-op where storage is unavailable. */
function savePm(id: string): void {
  try {
    localStorage.setItem(PM_KEY, id);
  } catch {
    /* private mode / quota exceeded — non-fatal for a demo */
  }
}

/** Copy `text`, preferring the async Clipboard API with a legacy fallback. */
async function copyText(text: string): Promise<void> {
  // The async API can throw *or reject* — blocked by permissions, a non-secure
  // context, or a synthetic (untrusted) click — so fall through to the legacy
  // path on any failure, not only when the API is missing.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through to execCommand */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy command was rejected');
}

/** Pending "copied" revert timers, keyed by button so rapid clicks don't stack. */
const flashTimers = new WeakMap<HTMLElement, number>();

/** Swap a copy button to its green checkmark, reverting after {@link COPIED_MS}. */
function flashCopied(btn: HTMLButtonElement): void {
  btn.classList.add('copied');
  btn.innerHTML = CHECK_ICON;
  btn.setAttribute('aria-label', 'Copied');
  const prev = flashTimers.get(btn);
  if (prev) clearTimeout(prev);
  flashTimers.set(
    btn,
    window.setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = COPY_ICON;
      btn.setAttribute('aria-label', 'Copy code');
      flashTimers.delete(btn);
    }, COPIED_MS),
  );
}

/** Copy the current command of the `<pre>` the clicked button belongs to. */
function onCopy(btn: HTMLButtonElement): void {
  const code = btn.closest('pre')?.querySelector('code');
  const text = code?.textContent ?? '';
  if (!text) return;
  copyText(text).then(
    () => flashCopied(btn),
    () => {
      /* clipboard blocked — leave the button as-is */
    },
  );
}

/** Switch the install command (and active tab) when a package-manager tab is clicked. */
function onTab(tab: HTMLButtonElement): void {
  const pm = PACKAGE_MANAGERS.find((p) => p.id === tab.dataset.pm);
  const pre = tab.closest('pre');
  const code = pre?.querySelector('code');
  if (!pm || !code) return;
  code.textContent = pm.cmd(PACKAGE);
  for (const t of pre!.querySelectorAll<HTMLButtonElement>('.pm-tab')) {
    const active = t === tab;
    t.classList.toggle('active', active);
    t.setAttribute('aria-pressed', String(active));
  }
  savePm(pm.id);
}

/** Append the floating copy button to a `<pre>` (idempotent per pre). */
function addCopyButton(pre: HTMLPreElement): void {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'code-copy';
  btn.setAttribute('aria-label', 'Copy code');
  btn.innerHTML = COPY_ICON;
  pre.append(btn);
}

/** Add the package-manager tab row to the install `<pre>` and seed the command. */
function addPmTabs(pre: HTMLPreElement, code: Element): void {
  pre.classList.add('pm-block');
  const active = loadPm();

  const tabs = document.createElement('span');
  tabs.className = 'pm-tabs';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Package manager');
  for (const pm of PACKAGE_MANAGERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = pm.id === active ? 'pm-tab active' : 'pm-tab';
    b.dataset.pm = pm.id;
    b.textContent = pm.id;
    b.setAttribute('aria-pressed', String(pm.id === active));
    tabs.append(b);
  }
  pre.prepend(tabs);

  // Seed the displayed command from the saved choice (replacing the highlighted
  // default — these are shell commands, so plain text reads cleaner anyway).
  const pm = PACKAGE_MANAGERS.find((p) => p.id === active) ?? PACKAGE_MANAGERS[1];
  code.textContent = pm.cmd(PACKAGE);
}

/** Whether `node` is, or contains, a `<pre>` (cheap filter for the observer). */
function hasPre(node: Node): boolean {
  return (
    node.nodeType === 1 &&
    ((node as Element).matches?.('pre') || !!(node as Element).querySelector?.('pre'))
  );
}

/** Enhance every not-yet-enhanced docs `<pre>`: copy button + install tabs. */
function enhance(): void {
  for (const pre of document.querySelectorAll<HTMLPreElement>('.view.docs pre')) {
    if (pre.querySelector(':scope > .code-copy')) continue; // already enhanced
    const code = pre.querySelector('code');
    if (code && code.textContent?.trim() === DOCS_INSTALL.trim()) {
      addPmTabs(pre, code);
    }
    addCopyButton(pre);
  }
}

let initialized = false;

/**
 * Wire copy buttons and the install tabs for the current page. Idempotent and
 * SSR-safe — call it once per demo after the page is interactive (a client
 * effect / `onMounted` / module bottom), the same place {@link initTooltips} is
 * called. A no-op on the server.
 */
export function initCodeBlocks(): void {
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

  // Re-enhance when new code blocks mount (SPA routes, runtime markdown). Only
  // react to added `<pre>` nodes, so the per-frame address-bar text updates and
  // our own injected controls never schedule needless work.
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  };
  new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (hasPre(node)) {
          schedule();
          return;
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Delegated, so clicks survive any re-render of the buttons/tabs.
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const copyBtn = el?.closest<HTMLButtonElement>('.code-copy');
    if (copyBtn) {
      onCopy(copyBtn);
      return;
    }
    const tab = el?.closest<HTMLButtonElement>('.pm-tab');
    if (tab) onTab(tab);
  });
}
