import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        core: 'src/core/index.ts',
        'vue-router': 'src/vue-router/index.ts',
        'react-router': 'src/react-router/index.tsx',
        'tanstack-react-router': 'src/tanstack-react-router/index.tsx',
        'angular-router': 'src/angular-router/index.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [/^vue/, /^react/, /^@angular\//, /^@tanstack\//],
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
