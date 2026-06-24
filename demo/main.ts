import {
  ALPHANUMERIC,
  BINARY,
  generateFrames,
  HEX,
  install,
  LOWER_ALPHA,
  MATRIX,
  SYMBOLS,
} from 'glyphnav';
import type { FrameInfo, GlyphEffect } from 'glyphnav';
import { initTheme } from './shared/theme';

// Mount the light/dark/system theme switcher (shared across every demo).
initTheme();

const bar = document.getElementById('bar')!;
const el = document.getElementById('path')!;
let navigating = false;

install({
  duration: 350,
  hooks: {
    onStart: () => (navigating = true),
    onFrame: (f) => {
      el.textContent = f.path;
      bar.classList.toggle('resolving', f.phase === 'resolve');
    },
  },
});

// Idle teaser: scramble the mirror through the demo paths until a real
// navigation takes over.
const targets = [
  '/vanilla',
  '/core',
  '/vue-router',
  '/react-router',
  '/solid-router',
  '/tanstack-router/react',
  '/tanstack-router/solid',
  '/angular-router',
  '/next',
  '/nuxt',
];
// Each pass picks the next style, so successive links never scramble the same
// way twice: a different glyph pool, effect and per-frame speed every time.
// These charsets get percent-encoded in a real address bar, but the idle
// teaser only writes to the on-page mirror, so anything goes here.
const styles: { charset: string; effect: GlyphEffect; speed: number }[] = [
  { charset: LOWER_ALPHA, effect: 'decode', speed: 45 },
  { charset: MATRIX, effect: 'scramble', speed: 32 },
  { charset: HEX, effect: 'decode', speed: 60 },
  { charset: BINARY, effect: 'scramble', speed: 28 },
  { charset: ALPHANUMERIC, effect: 'decode', speed: 50 },
  { charset: SYMBOLS, effect: 'scramble', speed: 38 },
];
let t = 0;

function play(frames: FrameInfo[], speed: number, done: () => void): void {
  let i = 0;

  const tick = (): void => {
    if (navigating) return;
    if (i >= frames.length) return done();
    const f = frames[i++];
    el.textContent = f.path;
    bar.classList.toggle('resolving', f.phase === 'resolve');
    setTimeout(tick, speed);
  };

  tick();
}

function loop(): void {
  if (navigating) return;

  const to = targets[t % targets.length];
  const { charset, effect, speed } = styles[t % styles.length];

  t += 1;

  play(generateFrames('/', to, { charset, effect }), speed, () => {
    setTimeout(loop, 1200);
  });
}
loop();
