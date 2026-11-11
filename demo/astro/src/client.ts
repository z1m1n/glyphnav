import { navigate } from 'astro:transitions/client';
import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { attachGlyphnav } from 'glyphnav/astro';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import {
  createHistoryToggle,
  currentUrl,
  DEFAULT_TOOLBAR,
  durationToSlider,
  glyphnavOptions,
  initActiveNav,
  initCodeBlocks,
  initFwMenu,
  initTheme,
  initTooltips,
  initWordmark,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
  syncActiveNav,
} from '@glyphnav-demo/shared';

const glyph = attachGlyphnav(navigate);
const bar = document.querySelector<HTMLElement>('.bar')!;
const path = bar.querySelector<HTMLElement>('.path')!;
const charset = document.querySelector<HTMLSelectElement>('#charset')!;
const duration = document.querySelector<HTMLInputElement>('#duration')!;
const effect = document.querySelector<HTMLSelectElement>('#effect')!;
const commit = document.querySelector<HTMLSelectElement>('#commit')!;
const scope = document.querySelector<HTMLSelectElement>('#scope')!;
const backForward = document.querySelector<HTMLInputElement>('#back-forward')!;
const ms = document.querySelector<HTMLElement>('.ms')!;
const saved = loadToolbar('astro', DEFAULT_TOOLBAR);

charset.value = saved.charset;
duration.value = String(durationToSlider(saved.duration));
effect.value = saved.effect;
commit.value = saved.commit;
scope.value = saved.scope;
backForward.checked = saved.backForward;

function showPath(value: string, resolving: boolean): void {
  path.textContent = value;
  bar.classList.toggle('resolving', resolving);
}

const toggleHistory = createHistoryToggle(() => glyph.controller.enableHistoryAnimation());
function apply(): void {
  const state = {
    charset: charset.value,
    duration: sliderToDuration(Number(duration.value)),
    effect: effect.value as GlyphEffect,
    commit: commit.value as CommitTiming,
    scope: scope.value as AnimateScope,
    backForward: backForward.checked,
  };
  ms.textContent = `${state.duration}ms`;
  duration.setAttribute('aria-valuetext', ms.textContent);
  glyph.controller.update(glyphnavOptions(state, showPath));
  toggleHistory(state.backForward);
  saveToolbar('astro', state);
}

document.querySelector('.controls')!.addEventListener('input', apply);
apply();
showPath(currentUrl(), false);
initTheme();
initFwMenu();
initTooltips();
initCodeBlocks();
initActiveNav();
initWordmark();

// Astro swaps the body. Move dynamically created shared helper nodes into the
// persisted mount before each swap, and carry the selected theme to the new root.
document.addEventListener('astro:before-swap', (event) => {
  const next = (event as TransitionBeforeSwapEvent).newDocument;
  next.documentElement.dataset.theme = document.documentElement.dataset.theme;
  const overlays = document.querySelector('[data-overlays]')!;
  for (const node of document.querySelectorAll('body > .theme-toggle, body > .glyph-tooltip')) {
    overlays.append(node);
  }
});

document.addEventListener('astro:page-load', () => {
  if (!glyph.controller.animating) showPath(currentUrl(), false);
  syncActiveNav();
});

if (import.meta.hot) import.meta.hot.dispose(() => glyph.detach());
