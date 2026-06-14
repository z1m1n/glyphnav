import type { NuxtGlyphnavInstance } from 'glyphnav/nuxt';

// The `.client` plugin provides `$glyphnav` (so it is absent during SSR/prerender
// — hence optional).
declare module '#app' {
  interface NuxtApp {
    $glyphnav?: NuxtGlyphnavInstance;
  }
}
