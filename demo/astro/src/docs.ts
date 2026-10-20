/** Setup snippets for the Astro demo's docs page. */
export const setup = `---
import { ClientRouter } from 'astro:transitions';
---
<head><ClientRouter /></head>
<script>
  import { navigate } from 'astro:transitions/client';
  import { attachGlyphnav } from 'glyphnav/astro';

  // Bundled scripts run once, even across ClientRouter swaps.
  const glyph = attachGlyphnav(navigate, { duration: 250 });
  // await glyph.navigate('/about/', { history: 'replace' });
</script>`;

export const variants = `const glyph = attachGlyphnav(navigate, { intercept: 'none' });
await glyph.navigate('/about/', { history: 'replace', state: { from: 'docs' } });

// Opt one anchor into animation:
const unlink = glyph.link(document.querySelector('a'));
unlink();
glyph.detach(); // remove listeners and cancel animation`;

export const options = `attachGlyphnav(navigate, {
  duration: 250,         // total animation time in milliseconds
  effect: 'scramble',    // 'decode' or 'scramble'
  commit: 'before',      // 'after' animates before navigating
  intercept: 'links',    // 'none' animates only explicit calls
  scope: 'tail',         // preserve the common path prefix
  animatePopState: true, // opt into browser back/forward animation
});`;
