import { generateFrames, install } from 'glyphnav';
import type { FrameInfo, GlyphEffect } from 'glyphnav';

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
  '/vue-router',
  '/react-router',
  '/tanstack-router',
  '/tanstack-solid-router',
  '/angular-router',
  '/next',
  '/nuxt',
];
let t = 0;

function play(frames: FrameInfo[], done: () => void): void {
  let i = 0;

  const tick = (): void => {
    if (navigating) return;
    if (i >= frames.length) return done();
    const f = frames[i++];
    el.textContent = f.path;
    bar.classList.toggle('resolving', f.phase === 'resolve');
    setTimeout(tick, 45);
  };

  tick();
}

function loop(): void {
  if (navigating) return;

  const to = targets[t % targets.length];
  const effect: GlyphEffect = t % 2 ? 'scramble' : 'decode';

  t += 1;

  play(generateFrames('/', to, { charset: 'abcdefghijklmnopqrstuvwxyz-_', effect }), () => {
    setTimeout(loop, 1200);
  });
}
loop();
