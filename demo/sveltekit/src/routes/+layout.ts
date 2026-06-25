// Static prerender: every route becomes a real file in the export.
export const prerender = true;

// Trailing slashes give folder-per-route output (`about/index.html`), so a cold
// deep-link reload serves a real file on GitHub Pages' static host.
export const trailingSlash = 'always';
