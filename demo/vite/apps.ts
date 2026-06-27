/**
 * The sub-routes each Vite demo serves beyond its `/` home. One source for two
 * things: the dev server's SPA fallback (which app owns a deep link) and the
 * post-build copy that gives every client route a real `index.html` on GitHub
 * Pages.
 */
export const DEMO_ROUTES: Record<string, string[]> = {
  vanilla: ['about', 'docs', 'contact'],
  'vue-router': ['about', 'features', 'docs'],
  'react-router': ['about', 'docs', 'blog'],
  'solid-router': ['about', 'posts', 'docs'],
  'tanstack-router/react': ['about', 'posts', 'docs'],
  'tanstack-router/solid': ['about', 'posts', 'docs'],
  'angular-router': ['about', 'docs', 'blog'],
};

/** The Vite demos that own deep links, in picker order. */
export const APP_NAMES = Object.keys(DEMO_ROUTES);
