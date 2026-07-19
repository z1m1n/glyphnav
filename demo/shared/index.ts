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
  createHistoryToggle,
  currentUrl,
  DEFAULT_TOOLBAR,
  DOCS_INSTALL,
  DOCS_PROVIDER_OPTIONS,
  durationToSlider,
  glyphnavOptions,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
  SPEED_SLIDER,
  TOOLBAR_SELECTS,
} from './content';
export type { SelectOption, ToolbarState } from './content';
export { DEMOS } from './demos';
export type { DemoEntry } from './demos';
export { initActiveNav, syncActiveNav } from './active-nav';
export { createGlyphText } from './glyph-text';
export type { GlyphText, TextEffectOptions } from './glyph-text';
export { highlight } from './highlight';
export { initCodeBlocks } from './code-blocks';
export { initInlineCode } from './inline-code';
export { initFwMenu } from './fw-menu';
export { initTheme, THEME_INIT_SCRIPT } from './theme';
export type { ThemePref } from './theme';
export { initTooltips } from './tooltip';
export { initWordmark } from './wordmark';
