import { install } from 'glyphnav';
import type { AnimateScope, CommitTiming, FrameInfo, GlyphEffect } from 'glyphnav';
import { highlight } from '../shared/highlight';
import {
  charsets,
  CONTROL_TOOLTIPS,
  currentUrl,
  DEFAULT_TOOLBAR,
  DOCS_INSTALL,
  durationToSlider,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
} from '../shared/content';
import { initTooltips } from '../shared/tooltip';

const BASE = import.meta.env.BASE_URL + 'vanilla';

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'vanilla';

/**
 * A code listing as a semantic `<figure>`: an optional `<figcaption>` label
 * followed by the highlighted snippet — so the docs read as captioned figures
 * instead of loose paragraphs interleaved with `<pre>`.
 */
const figure = (code: string, caption = '', captionId = ''): string => {
  const idAttr = captionId ? ` id="${captionId}"` : '';
  const cap = caption ? `<figcaption${idAttr}>${caption}</figcaption>` : '';
  return `<figure>${cap}<pre><code>${highlight(code)}</code></pre></figure>`;
};

interface Page {
  title: string;
  /** One-line lead shown under the title (phrasing HTML; may include `<code>`). */
  lead: string;
  /** Semantic block content after the header — figures, forms, sections. */
  html?: string;
}

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
  animatePopState: true, // browser back/forward animates too — on by default; false to disable
});`;

const pages: Record<string, Page> = {
  '/': {
    title: 'home',
    lead: 'No framework here. install() hijacks the links above; with commit: "navigate first" the page swaps instantly and the address bar decodes on top (mirrored in the line above).',
  },
  '/about': {
    title: 'about',
    lead: 'glyphnav rewrites history.replaceState frame by frame. The decode effect grows the path and resolves it left to right; the scramble effect bursts to full length and locks characters in random order.',
  },
  '/docs': {
    title: 'docs',
    lead: 'Install the package, then pick an integration: hijack links, or animate only programmatic calls.',
    html:
      figure(DOCS_INSTALL) +
      figure(DOCS_SETUP, 'Wire it up:') +
      figure(DOCS_OPTIONS, 'Every entry point accepts the same options object:', 'options') +
      '<aside class="note">Prefer to leave links alone? Pass <code>intercept: "none"</code> and call <code>navigate()</code> yourself. Curious about the engine on its own? See the <a href="/core/" data-glyphnav="off">/core</a> demo.</aside>',
  },
  '/contact': {
    title: 'contact',
    lead: 'Try the controls — your choices are remembered per page. "matrix" and "symbols" get percent-encoded by the browser in the real bar (expected for non-URL-safe glyphs). Deep links with ?query and #hash animate too: they are just part of the path.',
  },
};

const bar = document.getElementById('bar')!;
const pathEl = document.getElementById('path')!;
const view = document.getElementById('view')!;

function currentSub(): string {
  const sub = location.pathname.replace(BASE, '').replace(/\/$/, '');
  return sub === '' ? '/' : sub;
}

function render(): void {
  const sub = currentSub();
  const page = pages[sub] ?? { title: '404', lead: `No page at ${sub}` };
  view.className = `view${page.html ? ' docs' : ''}`;
  view.innerHTML =
    '<article>' +
    `<header class="lead"><h2>${page.title}</h2>${page.lead}</header>` +
    (page.html ?? '') +
    '</article>';
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

// Restore this page's toolbar (charset is stored as its option key). Resolve the
// key to a glyph pool only when handing options to the controller. Back/forward
// defaults on here — install({ intercept: 'links' }) enables it by default —
// unlike the opt-in router adapters.
const state = loadToolbar(STORE_KEY, { ...DEFAULT_TOOLBAR, backForward: true });
const glyphOptions = () => ({
  charset: charsets[state.charset],
  duration: state.duration,
  effect: state.effect,
  commit: state.commit,
  scope: state.scope,
});

// Manage the back/forward animation ourselves so the checkbox can toggle it
// live: install with it off, then attach/detach the popstate listener on demand.
const handle = install({ reload: false, animatePopState: false, hooks, ...glyphOptions() });
let stopPopState: (() => void) | null = state.backForward
  ? handle.controller.enableHistoryAnimation()
  : null;

window.addEventListener('popstate', render);
render();

const charsetSel = document.getElementById('charset') as HTMLSelectElement;
const speed = document.getElementById('speed') as HTMLInputElement;
const speedVal = document.getElementById('speedval')!;
const effectSel = document.getElementById('effect') as HTMLSelectElement;
const commitSel = document.getElementById('commit') as HTMLSelectElement;
const scopeSel = document.getElementById('scope') as HTMLSelectElement;
const backforward = document.getElementById('backforward') as HTMLInputElement;

// Styled tooltips describing each control, from the shared source.
charsetSel.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.charset;
speed.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.speed;
effectSel.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.effect;
commitSel.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.commit;
scopeSel.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.scope;
backforward.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.backForward;
initTooltips();

// Reflect the restored state in the controls.
charsetSel.value = state.charset;
effectSel.value = state.effect;
commitSel.value = state.commit;
scopeSel.value = state.scope;
speed.value = String(durationToSlider(state.duration));
speedVal.textContent = `${state.duration}ms`;
backforward.checked = state.backForward;

function apply(): void {
  handle.controller.update({ ...glyphOptions(), hooks });
  saveToolbar(STORE_KEY, state);
}

charsetSel.addEventListener('change', () => {
  state.charset = charsetSel.value;
  apply();
});
speed.addEventListener('input', () => {
  // Slider is inverted: full right = 20 ms (fastest whole animation).
  state.duration = sliderToDuration(Number(speed.value));
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

backforward.addEventListener('change', () => {
  state.backForward = backforward.checked;
  if (backforward.checked && !stopPopState) {
    stopPopState = handle.controller.enableHistoryAnimation();
  } else if (!backforward.checked && stopPopState) {
    stopPopState();
    stopPopState = null;
  }
  saveToolbar(STORE_KEY, state);
});
