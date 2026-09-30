import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

/** Keep both declaration graphs resolvable by NodeNext, including directory imports. */
async function writeNodeDeclarations(files: Map<string, string>): Promise<void> {
  const declarations = new Map(
    [...files]
      .filter(([path]) => path.endsWith('.d.ts'))
      .map(([path, content]) => [resolve(path), content]),
  );
  for (const [path, content] of declarations) {
    const rewrite = (extension: 'js' | 'cjs'): string =>
      content.replace(
        /(from\s*|import\s*\(\s*)(['"])([^'"]+)\2/g,
        (match, prefix: string, quote: string, specifier: string) => {
          if (!specifier.startsWith('.')) {
            // Next exposes file subpaths without an exports map. NodeNext needs
            // their runtime extension even when the declaration only uses types.
            return specifier.startsWith('next/') && !specifier.endsWith('.js')
              ? `${prefix}${quote}${specifier}.js${quote}`
              : match;
          }
          const target = resolve(dirname(path), specifier);
          const declaration = [
            target.replace(/\.js$/, '') + '.d.ts',
            resolve(target, 'index.d.ts'),
          ].find((candidate) => declarations.has(candidate));
          if (!declaration)
            throw new Error(`Unresolved declaration import ${specifier} in ${path}`);
          let resolved = relative(dirname(path), declaration)
            .replaceAll('\\', '/')
            .replace(/\.d\.ts$/, `.${extension}`);
          if (!resolved.startsWith('.')) resolved = `./${resolved}`;
          return `${prefix}${quote}${resolved}${quote}`;
        },
      );
    await writeFile(path, rewrite('js'));
    await writeFile(path.replace(/\.d\.ts$/, '.d.cts'), rewrite('cjs'));
  }
}

export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'oxc',
    sourcemap: false,
    emptyOutDir: true,
    lib: {
      // Each subpath's runtime and ESM/CJS declarations share one directory.
      entry: {
        index: 'src/index.ts',
        'core/index': 'src/core/index.ts',
        'vue-router/index': 'src/vue-router/index.ts',
        'react-router/index': 'src/react-router/index.tsx',
        'solid-router/index': 'src/solid-router/index.ts',
        'tanstack-router/react/index': 'src/tanstack-router/react/index.tsx',
        'tanstack-router/solid/index': 'src/tanstack-router/solid/index.ts',
        'angular-router/index': 'src/angular-router/index.ts',
        'preact-iso/index': 'src/preact-iso/index.tsx',
        'next/index': 'src/next/index.tsx',
        'nuxt/index': 'src/nuxt/index.ts',
        'sveltekit/index': 'src/sveltekit/index.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      output: {
        paths: (id) => (id.startsWith('next/') && !id.endsWith('.js') ? `${id}.js` : id),
      },
      external: [
        /^vue/,
        /^react/,
        /^solid-js/,
        /^@solidjs\//,
        /^@angular\//,
        /^@tanstack\//,
        /^preact/,
        /^next/,
        /^svelte/,
        /^@sveltejs\//,
      ],
    },
  },
  plugins: [
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.build.json',
      bundleTypes: false,
      // Hoist inferred `import('react').ReactNode`-style references to
      // top-of-file static imports instead of inline dynamic imports.
      staticImport: true,
      afterBuild: writeNodeDeclarations,
    }),
  ],
});
