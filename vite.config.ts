import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'oxc',
    sourcemap: false,
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        core: 'src/core/index.ts',
        'vue-router': 'src/vue-router/index.ts',
        'react-router': 'src/react-router/index.tsx',
        'tanstack-router/react': 'src/tanstack-router/react/index.tsx',
        'tanstack-router/solid': 'src/tanstack-router/solid/index.ts',
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
