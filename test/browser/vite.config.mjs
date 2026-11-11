import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('./fixture', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./fixture/node_modules/.vite/', import.meta.url)),
  plugins: [react()],
  server: { host: 'localhost', port: 4179, strictPort: true },
});
