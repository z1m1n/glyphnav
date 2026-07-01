import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'oxc',
    sourcemap: false,
    emptyOutDir: true,
    lib: {
      // Entries emit as `dist/<name>/index.{js,cjs}` so each subpath's JS sits
      // next to its `index.d.ts` (the dts plugin mirrors `src/`). Co-locating
      // them lets the extensionless relative imports inside the emitted `.d.ts`
      // (`from '../core'`) resolve to the directory index instead of being
      // shadowed by a flat `core.js` that has no sibling declaration file.
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
    }),
  ],
});
