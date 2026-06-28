// Starts the Next.js demo dev server on the port from demo/.env.
//
// Next reads its dev-server port only from `--port`/$PORT and has no config-file
// hook (unlike the Nuxt and SvelteKit demos, whose configs read demo/ports.ts
// directly). So this tiny launcher resolves the port from demo/.env — the single
// source of truth shared with the picker proxy (demo/vite/proxy.ts) — and hands
// off to `next dev`. Run via `pnpm demo:next`.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No demo/.env — fall back to the documented default below.
}

const port = process.env.GLYPHNAV_PORT_NEXT || '5174';

const child = spawn('next', ['dev', '--port', port], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});

// Forward Ctrl-C / `run-p` termination so the dev server shuts down cleanly.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 0));
