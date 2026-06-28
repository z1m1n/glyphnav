import { fileURLToPath } from 'node:url';

/**
 * Single source of truth for the demo dev-server ports. Loads `demo/.env` and
 * exposes the parsed values, so every framework's own dev server and the picker
 * proxy that forwards to it ({@link file://./vite/proxy.ts}) read the same number
 * and can't drift apart — change a port in `demo/.env` and both follow.
 *
 * `.env` is loaded the first time this module is imported, resolved relative to
 * this file so the working directory doesn't matter (the Vite playground runs
 * from the repo root, the Nuxt/SvelteKit configs from their package dirs). A
 * missing file or unset/invalid key falls back to the documented default below,
 * so the demos still start without it.
 */
try {
  process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));
} catch {
  // No demo/.env — fall back to the defaults in `ports` below.
}

const port = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

/** Resolved dev-server ports, keyed by demo. */
export const ports = {
  /** Vite playground — the picker plus the seven Vite-hosted demos. */
  vite: port('GLYPHNAV_PORT_VITE', 5173),
  /** Next.js demo's own dev server. */
  next: port('GLYPHNAV_PORT_NEXT', 5174),
  /** Nuxt demo's own dev server. */
  nuxt: port('GLYPHNAV_PORT_NUXT', 5176),
  /** SvelteKit demo's own dev server. */
  sveltekit: port('GLYPHNAV_PORT_SVELTEKIT', 5177),
} as const;
