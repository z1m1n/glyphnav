import {
  HEX,
  MATRIX,
  SYMBOLS,
  URL_SAFE,
  install,
  type AnimateScope,
  type CommitTiming,
  type FrameInfo,
  type GlyphEffect,
} from 'glyphnav';

const BASE = '/vanilla';

const esc = (code: string): string =>
  code.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const codeBlock = (code: string): string => `<pre><code>${esc(code)}</code></pre>`;

interface Page {
  title: string;
  body: string;
  /** Raw HTML appended after the body paragraph (already escaped). */
  html?: string;
}

const DOCS_INSTALL = `pnpm add glyphnav`;

const DOCS_SETUP = `import { install, navigate } from 'glyphnav';

// Hijack same-origin <a> clicks; commit via pushState (SPA) …
install({ reload: false });
// … or hard-reload like a classic multi-page site:
install();

// Programmatic, with per-call options:
await navigate('/about?q=42#results', { effect: 'scramble' });`;

const DOCS_OPTIONS = `install({
  duration: 250,        // total animation time (ms), spread over all frames
  effect: 'scramble',   // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit: 'before',     // navigate instantly, animate on top ('after' = classic order)
  charset: MATRIX,      // glyph pool — URL_SAFE stays readable in the bar
  scope: 'tail',        // animate only the part that differs from the current path
});`;

const pages: Record<string, Page> = {
  '/': {
    title: 'home',
    body: 'No framework here. install() hijacks the links above; with commit: "navigate first" the page swaps instantly and the address bar decodes on top (mirrored in the line above).',
  },
  '/about': {
    title: 'about',
    body: 'glyphnav rewrites history.replaceState frame by frame. The decode effect grows the path and resolves it left to right; the scramble effect bursts to full length and locks characters in random order.',
  },
  '/docs': {
    title: 'docs',
    body: 'Install the package, then pick an integration: hijack links, or animate only programmatic calls.',
    html:
      codeBlock(DOCS_INSTALL) +
      '<p>Wire it up:</p>' +
      codeBlock(DOCS_SETUP) +
      '<p id="options">Every entry point accepts the same options object:</p>' +
      codeBlock(DOCS_OPTIONS) +
      '<p>Prefer to leave links alone? Pass <code>intercept: "none"</code> and call <code>navigate()</code> yourself.</p>',
  },
  '/contact': {
    title: 'contact',
    body: 'Try the controls. "matrix" and "symbols" get percent-encoded by the browser in the real bar — expected for non-URL-safe glyphs. Deep links with ?query and #hash animate too: they are just part of the path.',
  },
};

const charsets: Record<string, string> = { url: URL_SAFE, hex: HEX, matrix: MATRIX, symbols: SYMBOLS };

const bar = document.getElementById('bar')!;
const pathEl = document.getElementById('path')!;
const view = document.getElementById('view')!;

function currentUrl(): string {
  return location.pathname + location.search + location.hash;
}

function currentSub(): string {
  const sub = location.pathname.replace(BASE, '').replace(/\/$/, '');
  return sub === '' ? '/' : sub;
}

function render(): void {
  const sub = currentSub();
  const page = pages[sub] ?? { title: '404', body: `No page at ${sub}` };
  const docs = page.html ? ` docs` : '';
  view.className = `view${docs}`;
  view.innerHTML = `<h2>${page.title}</h2><p>${page.body}</p>${page.html ?? ''}`;
  pathEl.textContent = currentUrl();
  document.querySelectorAll<HTMLAnchorElement>('#nav a').forEach((a) => {
    const here = new URL(a.href).pathname.replace(/\/$/, '');
    a.classList.toggle('active', here === location.pathname.replace(/\/$/, ''));
  });
}

// The view itself re-renders on the synthetic popstate that commit() fires —
// instantly in navigate-first mode. The hooks only drive the bar mirror.
const hooks = {
  onFrame: (f: FrameInfo) => {
    pathEl.textContent = f.path;
    bar.classList.toggle('resolving', f.phase === 'resolve');
  },
  onComplete: () => {
    bar.classList.remove('resolving');
    pathEl.textContent = currentUrl();
  },
};

const state = {
  charset: URL_SAFE,
  duration: 250,
  effect: 'decode' as GlyphEffect,
  commit: 'before' as CommitTiming,
  scope: 'full' as AnimateScope,
};

const handle = install({ reload: false, hooks, ...state });

window.addEventListener('popstate', render);
render();

const charsetSel = document.getElementById('charset') as HTMLSelectElement;
const speed = document.getElementById('speed') as HTMLInputElement;
const speedVal = document.getElementById('speedval')!;
const effectSel = document.getElementById('effect') as HTMLSelectElement;
const commitSel = document.getElementById('commit') as HTMLSelectElement;
const scopeSel = document.getElementById('scope') as HTMLSelectElement;

function apply(): void {
  handle.controller.update({ ...state, hooks });
}

charsetSel.addEventListener('change', () => {
  state.charset = charsets[charsetSel.value];
  apply();
});
speed.addEventListener('input', () => {
  // Slider is inverted: full right = 20 ms (fastest whole animation).
  state.duration = 1020 - Number(speed.value);
  speedVal.textContent = `${state.duration}ms`;
  apply();
});
effectSel.addEventListener('change', () => {
  state.effect = effectSel.value as GlyphEffect;
  apply();
});
commitSel.addEventListener('change', () => {
  state.commit = commitSel.value as CommitTiming;
  apply();
});
scopeSel.addEventListener('change', () => {
  state.scope = scopeSel.value as AnimateScope;
  apply();
});
