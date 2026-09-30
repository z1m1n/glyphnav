import { install } from 'glyphnav';

window.glyphResults = [];
install({
  reload: false,
  commit: 'after',
  duration: 200,
  charset: 'xyzw',
  hooks: { onComplete: (_context, result) => window.glyphResults.push(result) },
});
