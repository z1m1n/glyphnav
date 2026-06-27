import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fromDemoRoot } from './paths';

const nodeRequire = createRequire(import.meta.url);

/** The glyphnav library's own version, read from the repo's root manifest. */
export const glyphnavVersion = (
  JSON.parse(readFileSync(fromDemoRoot('../package.json'), 'utf8')) as { version: string }
).version;

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
