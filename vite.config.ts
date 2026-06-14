import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'oxc',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        core: 'src/core/index.ts',
        'vue-router': 'src/vue-router/index.ts',
        'react-router': 'src/react-router/index.tsx',
        'tanstack-react-router': 'src/tanstack-react-router/index.tsx',
        'tanstack-solid-router': 'src/tanstack-solid-router/index.ts',
        'angular-router': 'src/angular-router/index.ts',
        next: 'src/next/index.tsx',
        nuxt: 'src/nuxt/index.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [/^vue/, /^react/, /^solid-js/, /^@angular\//, /^@tanstack\//, /^next/],
    },
  },
  plugins: [
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.build.json',
      bundleTypes: true,
    }),
  ],
});
