import { install } from 'glyphnav';
import type { AnimateScope, CommitTiming, FrameInfo, GlyphEffect } from 'glyphnav';
import { highlight } from '../shared/highlight';
import { charsets, currentUrl, DOCS_INSTALL, sliderToDuration } from '../shared/content';
import { createGlyphText } from './glyph-text';
import type { GlyphText } from './glyph-text';

const BASE = import.meta.env.BASE_URL + 'vanilla';

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
});`;

// The text shown on the /core stage before you type your own.
const CORE_DEFAULT = 'decode any text — not just the URL';

const CORE_SNIPPET = `import { generateFrames, createPlayer } from 'glyphnav';

const heading = document.querySelector('h2');

// The same frames the address bar steps through — there's no URL prefix
// to hold fixed, so the whole string scrambles.
const frames = generateFrames('', 'decode any text', {
  effect: 'scramble',
  charset: MATRIX,
  duration: 600,
  preserveLeadingSlash: false,
});

// A Player just fires N evenly-spaced ticks. The address-bar adapter writes
// each frame to history.replaceState; here we write it to textContent.
const player = createPlayer();
player.play(frames.length, 600 / (frames.length - 1), (i) => {
  heading.textContent = frames[i].text;
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
      '<aside class="note">Prefer to leave links alone? Pass <code>intercept: "none"</code> and call <code>navigate()</code> yourself.</aside>',
  },
  '/contact': {
    title: 'contact',
    lead: 'Try the controls. "matrix" and "symbols" get percent-encoded by the browser in the real bar — expected for non-URL-safe glyphs. Deep links with ?query and #hash animate too: they are just part of the path.',
  },
  '/core': {
    title: 'core',
    lead: 'The address-bar effect is just two core pieces — generateFrames() builds the in-between strings, a Player ticks through them. Point that Player at a DOM node instead of history and any text decodes the same way:',
    html:
      '<section class="core-demo">' +
      '<output class="glyph-stage" id="stage" for="coreinput"></output>' +
      '<form class="core-form" id="coretext">' +
      `<input id="coreinput" type="text" value="${CORE_DEFAULT}" aria-label="text to scramble" />` +
      '<button type="submit">decode →</button>' +
      '</form>' +
      '</section>' +
      figure(
        CORE_SNIPPET,
        'The same two calls, pointed at an element instead of the address bar:',
      ) +
      '<aside class="note">Charset, effect and speed (the controls above) drive this too — change one and the line re-scrambles. Type your own text and run it; navigating here still animates the real address bar, like every other link.</aside>',
  },
};

const bar = document.getElementById('bar')!;
const pathEl = document.getElementById('path')!;
const view = document.getElementById('view')!;

function currentSub(): string {
  const sub = location.pathname.replace(BASE, '').replace(/\/$/, '');
  return sub === '' ? '/' : sub;
}

// The /core page's text animator, alive only while that page is mounted, plus a
// closure to re-run it with the current controls. Both are cleared whenever the
// view re-renders so a stale Player never writes to a detached node.
let glyphText: GlyphText | null = null;
let rerunCore: (() => void) | null = null;

// Wire up the /core demo after its markup is in the DOM: scramble the stage into
// the entered text, both on submit and (via rerunCore) when a control changes.
function setupCore(): void {
  const stage = document.getElementById('stage');
  const form = document.getElementById('coretext') as HTMLFormElement | null;
  const input = document.getElementById('coreinput') as HTMLInputElement | null;
  const button = form?.querySelector('button');
  if (!stage || !form || !input || !button) return;

  glyphText = createGlyphText(stage);
  rerunCore = () => {
    // The button names the effect it will run, so its label tracks the effect
    // control ("decode →" / "scramble →").
    button.textContent = `${state.effect} →`;
    void glyphText?.run(input.value || CORE_DEFAULT, {
      charset: state.charset,
      duration: state.duration,
      effect: state.effect,
    });
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    rerunCore?.();
  });
  rerunCore();
}

function render(): void {
  glyphText?.cancel();
  glyphText = null;
  rerunCore = null;

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

  // Hide the navigation-only controls on the /core text demo: commit timing and
  // scope ('tail' animates only the path tail that differs from the current
  // path) are URL concepts with nothing to act on when scrambling a DOM node.
  const navOnly = sub === '/core' ? 'none' : '';
  for (const id of ['ctl-commit', 'ctl-scope']) {
    const ctl = document.getElementById(id);
    if (ctl) ctl.style.display = navOnly;
  }

  if (sub === '/core') setupCore();
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
  charset: charsets.url,
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
  // On the /core page, the same knobs drive the text stage — re-scramble it so
  // a charset/effect/speed change is visible immediately, not just on the URL.
  rerunCore?.();
}

charsetSel.addEventListener('change', () => {
  state.charset = charsets[charsetSel.value];
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
