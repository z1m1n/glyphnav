/**
 * The /core demo: the address-bar engine pointed at a DOM node instead of
 * history. `generateFrames()` builds the in-between strings and a `Player`
 * (here, `createGlyphText`) ticks through them, writing each frame to a
 * `<span>` — so any text decodes the same way the URL does.
 *
 * Its own page (reachable from the picker), so it carries its own controls
 * toolbar. Only the three knobs that apply to text — charset, speed, effect —
 * are shown; commit timing and scope are URL concepts with nothing to act on
 * here. State is persisted under this page's own localStorage key.
 */
import type { GlyphEffect } from 'glyphnav/core';
import { highlight } from '../shared/highlight';
import {
  charsets,
  CONTROL_TOOLTIPS,
  DEFAULT_TOOLBAR,
  durationToSlider,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
} from '../shared/content';
import { initTheme } from '../shared/theme';
import { initTooltips } from '../shared/tooltip';
import { createGlyphText } from './glyph-text';

// Mount the light/dark/system theme switcher (shared across every demo).
initTheme();

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'core';

/** The text shown on the stage before you type your own. */
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

// Only the knobs that apply to scrambling text — charset, speed, effect.
const state = loadToolbar(STORE_KEY, {
  charset: DEFAULT_TOOLBAR.charset,
  duration: DEFAULT_TOOLBAR.duration,
  effect: DEFAULT_TOOLBAR.effect,
});

const stage = document.getElementById('stage')!;
const form = document.getElementById('coretext') as HTMLFormElement;
const input = document.getElementById('coreinput') as HTMLInputElement;
const button = form.querySelector('button')!;
const charsetSel = document.getElementById('charset') as HTMLSelectElement;
const speed = document.getElementById('speed') as HTMLInputElement;
const speedVal = document.getElementById('speedval')!;
const effectSel = document.getElementById('effect') as HTMLSelectElement;

// Render the snippet and wire the styled control tooltips from the shared sources.
document.getElementById('snippet')!.innerHTML = highlight(CORE_SNIPPET);
charsetSel.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.charset;
speed.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.speed;
effectSel.closest('label')!.dataset.tip = CONTROL_TOOLTIPS.effect;
initTooltips();

// Reflect the restored state in the controls.
charsetSel.value = state.charset;
effectSel.value = state.effect;
speed.value = String(durationToSlider(state.duration));
speedVal.textContent = `${state.duration}ms`;
// Slider value is inverted (20 = fastest), so announce the real duration.
speed.setAttribute('aria-valuetext', `${state.duration}ms`);

const glyphText = createGlyphText(stage);

function rerun(): void {
  // The button names the effect it will run ("decode →" / "scramble →").
  button.textContent = `${state.effect} →`;
  void glyphText.run(input.value || CORE_DEFAULT, {
    charset: charsets[state.charset],
    duration: state.duration,
    effect: state.effect,
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  rerun();
});
charsetSel.addEventListener('change', () => {
  state.charset = charsetSel.value;
  saveToolbar(STORE_KEY, state);
  rerun();
});
speed.addEventListener('input', () => {
  // Slider is inverted: full right = 20 ms (fastest whole animation).
  state.duration = sliderToDuration(Number(speed.value));
  speedVal.textContent = `${state.duration}ms`;
  speed.setAttribute('aria-valuetext', `${state.duration}ms`);
  saveToolbar(STORE_KEY, state);
  rerun();
});
effectSel.addEventListener('change', () => {
  state.effect = effectSel.value as GlyphEffect;
  saveToolbar(STORE_KEY, state);
  rerun();
});

rerun();
