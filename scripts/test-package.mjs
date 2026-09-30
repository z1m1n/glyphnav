import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(tmpdir(), 'glyphnav-package-'));
const consumer = join(temporary, 'consumer');
const run = (command, args, cwd = consumer) =>
  execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8', timeout: 30_000 });

try {
  await mkdir(join(consumer, 'node_modules', 'glyphnav'), { recursive: true });
  const [packed] = JSON.parse(
    run(
      'npm',
      [
        'pack',
        '--ignore-scripts',
        '--json',
        '--cache',
        join(temporary, 'npm-cache'),
        '--pack-destination',
        temporary,
      ],
      root,
    ),
  );
  run('tar', [
    '-xzf',
    join(temporary, packed.filename),
    '--strip-components=1',
    '-C',
    join(consumer, 'node_modules', 'glyphnav'),
  ]);
  // Peers come from this workspace; glyphnav itself comes only from the tarball.
  for (const entry of await readdir(join(root, 'node_modules'))) {
    if (entry.startsWith('.') || entry === 'glyphnav') continue;
    await symlink(join(root, 'node_modules', entry), join(consumer, 'node_modules', entry), 'dir');
  }
  const entrypoints = Object.keys(manifest.exports).filter((entry) => entry !== './package.json');
  for (const entry of entrypoints) {
    const specifier = entry === '.' ? 'glyphnav' : `glyphnav/${entry.slice(2)}`;
    for (const [extension, declaration] of [
      ['mts', '.d.ts'],
      ['cts', '.d.cts'],
    ]) {
      const fixture = join(consumer, `consumer.${extension}`);
      const expectedTypes =
        manifest.exports[entry][extension === 'mts' ? 'import' : 'require'].types;
      assert.ok(expectedTypes.endsWith(declaration), `${specifier}: wrong declaration format`);
      // Use a public member so unresolved internal types cannot silently turn
      // the imported API into any. Separate programs avoid router augmentations
      // from different TanStack frameworks colliding in their shared peer.
      const member =
        entry === '.' || entry === './core'
          ? 'createGlyphnav'
          : entry === './angular-router'
            ? 'createGlyphnavNavigator'
            : entry === './sveltekit' || entry === './vue-router' || entry === './nuxt'
              ? 'attachGlyphnav'
              : 'GlyphnavLink';
      await writeFile(
        fixture,
        `import * as api from '${specifier}';\nconst member: typeof api.${member} = api.${member};\nvoid member;\n`,
      );
      const config = join(consumer, 'tsconfig.json');
      await writeFile(
        config,
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            skipLibCheck: false,
            noEmit: true,
            types: ['node'],
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          },
          files: [fixture],
        }),
      );
      try {
        run(join(root, 'node_modules', '.bin', 'tsc'), ['-p', config]);
      } catch (error) {
        throw new Error(
          `${specifier} (${extension}) consumer failed:\n${error.stdout ?? ''}${error.stderr ?? ''}`,
          { cause: error },
        );
      }
    }
    const esm = join(consumer, 'runtime.mjs');
    const cjs = join(consumer, 'runtime.cjs');
    const solid = entry === './solid-router' || entry === './tanstack-router/solid';
    const browserSetup = solid
      ? "const { JSDOM } = await import('jsdom');\nconst dom = new JSDOM('<!doctype html>', { url: 'http://localhost/' });\nglobalThis.window = dom.window;\nglobalThis.document = dom.window.document;\n"
      : '';
    const angularSetup = entry === './angular-router' ? "await import('@angular/compiler');\n" : '';
    // Solid's browser build schedules a persistent queue. These smoke checks
    // validate module loading only; the real-browser suite covers navigation.
    const browserCleanup = solid ? 'dom.window.close();\nprocess.exit(0);' : '';
    await writeFile(
      esm,
      `${browserSetup}${angularSetup}const api = await import('${specifier}');\nif (!Object.keys(api).length) throw new Error('Empty ESM entry');\n${browserCleanup}\n`,
    );
    await writeFile(
      cjs,
      `${solid ? "const { JSDOM } = require('jsdom');\nconst dom = new JSDOM('<!doctype html>', { url: 'http://localhost/' });\nglobalThis.window = dom.window;\nglobalThis.document = dom.window.document;\n" : ''}${entry === './angular-router' ? "require('@angular/compiler');\n" : ''}const api = require('${specifier}');\nif (!Object.keys(api).length) throw new Error('Empty CJS entry');\n${browserCleanup}\n`,
    );
    let nativeCjsPeerLimited = false;
    for (const fixture of [esm, cjs]) {
      try {
        run(process.execPath, [...(solid ? ['--conditions=browser'] : []), fixture]);
      } catch (error) {
        // This installed peer's CJS build requires an import-only dependency.
        // Keep the exception exact: package errors and all other peers fail.
        if (
          entry === './tanstack-router/solid' &&
          fixture === cjs &&
          error.stderr?.includes('ERR_PACKAGE_PATH_NOT_EXPORTED') &&
          error.stderr.includes('@solid-primitives/refs/package.json')
        ) {
          nativeCjsPeerLimited = true;
          continue;
        }
        throw new Error(
          `${specifier} runtime failed:\n${error.stdout ?? ''}${error.stderr ?? ''}`,
          { cause: error },
        );
      }
    }
    console.log(
      `✓ ${specifier}: NodeNext ESM/CJS types, ESM runtime${
        nativeCjsPeerLimited
          ? '; native CJS limited by @tanstack/solid-router peer (@solid-primitives/refs exports)'
          : ', CJS runtime'
      }`,
    );
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
