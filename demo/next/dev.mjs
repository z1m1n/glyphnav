// Starts the Next.js demo dev server on the port from demo/.env.
//
// Next reads its dev-server port only from `--port`/$PORT and has no config-file
// hook (unlike the Nuxt and SvelteKit demos, whose configs read demo/ports.ts
// directly). So this tiny launcher resolves the port from demo/.env — the single
// source of truth shared with the picker proxy (demo/vite/proxy.ts) — and hands
// off to `next dev`. The Next demo consumes the library's dist, so build it
// before starting Next and keep a build watcher alive for source edits.
// Run via `pnpm demo:next`.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../..', import.meta.url));
const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const run = (args) =>
  new Promise((resolve, reject) => {
    const build = spawn(process.execPath, [vite, ...args], { cwd: root, stdio: 'inherit' });
    build.on('error', reject);
    build.on('exit', (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`Library build failed (${signal ?? code})`)),
    );
  });

await run(['build']);
const watcher = spawn(process.execPath, [vite, 'build', '--watch', '--emptyOutDir=false'], {
  cwd: root,
  stdio: 'inherit',
});

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

// Forward Ctrl-C / `run-p` termination to both processes.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    watcher.kill(signal);
    child.kill(signal);
  });
}
watcher.on('error', (error) => {
  console.error(error);
  child.kill('SIGTERM');
});
watcher.on('exit', (code) => {
  if (code && child.exitCode === null) child.kill('SIGTERM');
});
child.on('error', (error) => {
  console.error(error);
  watcher.kill('SIGTERM');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  watcher.kill('SIGTERM');
  process.exitCode = code ?? 0;
});
