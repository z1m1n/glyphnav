// Shared demo helpers. The Vite playground imports these files directly
// (`../shared/content`, `../shared/highlight`); the Next.js and Nuxt demos —
// separate build systems — consume them through this package entry
// (`@glyphnav-demo/shared`). One source of truth either way.
//
// Exports are named explicitly rather than re-exported with `export *`: Vite's
// dev server caches a star-barrel's expansion, so adding an export to a
// re-exported module while the Next/Nuxt dev server is running leaves the barrel
// stale until a restart. Listing each binding means adding one here re-transforms
// this file, so a new export shows up without restarting the server. Add new
// shared exports to this list.
export {
  charsets,
  CONTROL_TOOLTIPS,
  currentUrl,
  DEFAULT_TOOLBAR,
  DOCS_INSTALL,
  durationToSlider,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
} from './content';
export type { ToolbarState } from './content';
export { highlight } from './highlight';
export { initTooltips } from './tooltip';
