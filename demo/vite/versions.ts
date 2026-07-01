import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { glyphnavVersion } from '../shared/internal/version';

const nodeRequire = createRequire(import.meta.url);

/** The glyphnav library's own version, read once and shared by every build pipeline. */
export { glyphnavVersion };

/**
 * Read an installed dependency's version from its `package.json`.
 *
 * Some packages (e.g. `@solidjs/router`) restrict `exports` and don't expose
 * `./package.json`, so a direct require throws; the entry is then resolved and
 * the search walks up to the nearest manifest that carries a `version`.
 *
 * @param name - The package specifier to look up.
 * @returns The dependency's declared version.
 */
export const pkgVersion = (name: string): string => {
  try {
    return (nodeRequire(`${name}/package.json`) as { version: string }).version;
  } catch {
    let dir = dirname(nodeRequire.resolve(name));
    for (;;) {
      const file = join(dir, 'package.json');
      if (existsSync(file)) {
        const { version } = JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
        if (version) return version;
      }
      const parent = dirname(dir);
      if (parent === dir) throw new Error(`[demo] cannot read version for ${name}`);
      dir = parent;
    }
  }
};

const STACK_BY_APP: Record<string, () => string> = {
  vanilla: () => `glyphnav ${glyphnavVersion}`,
  core: () => `glyphnav ${glyphnavVersion}`,
  changelog: () => `glyphnav ${glyphnavVersion}`,
  'vue-router': () => `vue ${pkgVersion('vue')} · vue-router ${pkgVersion('vue-router')}`,
  'react-router': () => `react ${pkgVersion('react')} · react-router ${pkgVersion('react-router')}`,
  'solid-router': () =>
    `solid-js ${pkgVersion('solid-js')} · @solidjs/router ${pkgVersion('@solidjs/router')}`,
  'tanstack-router/react': () =>
    `react ${pkgVersion('react')} · @tanstack/react-router ${pkgVersion('@tanstack/react-router')}`,
  'tanstack-router/solid': () =>
    `solid-js ${pkgVersion('solid-js')} · @tanstack/solid-router ${pkgVersion('@tanstack/solid-router')}`,
  'angular-router': () =>
    `angular ${pkgVersion('@angular/core')} · @angular/router ${pkgVersion('@angular/router')}`,
  'preact-iso': () => `preact ${pkgVersion('preact')} · preact-iso ${pkgVersion('preact-iso')}`,
};

/**
 * The framework + router stack label shown muted in a demo's footer, selected
 * from the demo's HTML file path. Read from the installed `package.json` files so
 * the labels never drift from the deps; the vanilla, core and changelog pages
 * have no framework and fall back to the library version.
 *
 * @param filename - The HTML file being transformed.
 * @returns The footer label, or `''` for a page with no registered stack.
 */
export const stackForFile = (filename: string): string => {
  const path = filename.replace(/\\/g, '/').replace(/\/?index\.html$/, '');
  const app = Object.keys(STACK_BY_APP).find((name) => path.endsWith(name));
  return app ? STACK_BY_APP[app]() : '';
};

/**
 * vanilla, core and changelog have no separate framework/router packages —
 * their `STACK_BY_APP` entry is just the glyphnav version itself, which the
 * footer already shows directly. A tooltip restating "paired with glyphnav
 * vX" on top of that would be redundant, so these get none.
 */
const NO_TIP_APPS = new Set(['vanilla', 'core', 'changelog']);

/**
 * Tooltip text for the footer's `.stack` span, spelling out the exact package
 * versions this page runs (the footer text itself, restated) alongside the
 * glyphnav version. `''` for pages where that would just repeat the footer
 * (see {@link NO_TIP_APPS}) — the demo omits the tooltip entirely in that case.
 *
 * @param filename - The HTML file being transformed.
 * @returns The tooltip text, or `''` for a page with no tooltip.
 */
export const stackTipForFile = (filename: string): string => {
  const path = filename.replace(/\\/g, '/').replace(/\/?index\.html$/, '');
  const app = Object.keys(STACK_BY_APP).find((name) => path.endsWith(name));
  if (!app || NO_TIP_APPS.has(app)) return '';
  return `This page runs ${STACK_BY_APP[app]()}, paired with glyphnav v${glyphnavVersion}.`;
};
