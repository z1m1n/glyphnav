import type { Plugin } from 'vite';
import { THEME_INIT_SCRIPT } from '../../shared/theme';

/**
 * Inline the pre-paint theme script at the very top of every demo's `<head>`, so
 * an explicit light/dark choice (or the OS default) applies before first paint —
 * no flash. Injected as a tag descriptor, not a string splice, so Vite emits it
 * verbatim and never treats it as a module entry to bundle.
 *
 * @returns The Vite plugin.
 */
export function injectThemeInit(): Plugin {
  return {
    name: 'demo-inject-theme',
    transformIndexHtml() {
      return [{ tag: 'script', children: THEME_INIT_SCRIPT, injectTo: 'head-prepend' }];
    },
  };
}
