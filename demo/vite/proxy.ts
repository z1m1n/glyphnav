import type { ProxyOptions } from 'vite';
import { ports } from '../ports';
import { base } from './paths';

/**
 * A dev-server proxy for a demo that runs on its own server (Next, Nuxt,
 * SvelteKit, Astro). Forwards the picker link to that server; if it isn't running,
 * replies with a hint page rather than an opaque error or the silently-wrong
 * SPA-fallback picker.
 *
 * @param target - Origin of the demo's own dev server.
 * @param name - The demo's URL segment, shown in the hint.
 * @param command - The command that starts the demo, shown in the hint.
 * @returns Proxy options for one entry of Vite's `server.proxy` map.
 */
export function devProxy(target: string, name: string, command: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    ws: true,
    configure(proxy) {
      proxy.on('error', (_err, _req, res) => {
        if (!('writeHead' in res)) {
          res.destroy();
          return;
        }
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/html' });
        res.end(
          `<!doctype html><meta charset="utf-8">` +
            `<body style="font:15px ui-monospace,monospace;max-width:40rem;margin:3rem auto;padding:0 1.25rem">` +
            `<h2>/${name} isn't running</h2>` +
            `<p>This demo has its own dev server. Start it in another terminal:</p>` +
            `<pre style="background:#f2f2f2;padding:.6rem .9rem">${command}</pre>` +
            `<p>…then revisit this link, or start everything at once with ` +
            `<code>pnpm demo</code>. To preview the built site instead:</p>` +
            `<pre style="background:#f2f2f2;padding:.6rem .9rem">pnpm demo:build && pnpm demo:preview</pre>` +
            `<p><a href="/">← back to the picker</a></p>`,
        );
      });
    },
  };
}

const proxyBase = base.replace(/\/$/, '');

/**
 * Cross-server proxy map for the dev server. `pnpm demo` starts every demo at
 * once; this Vite server hosts the Vite-based demos, while Next, Nuxt,
 * SvelteKit and Astro run on their own servers and are proxied here so the combined picker
 * works at one origin. Their `/next`, `/nuxt`, `/sveltekit` and `/astro` prefixes (and the
 * `_next`/`_nuxt` assets) are unique, so nothing else is caught.
 */
export const crossServerProxy: Record<string, ProxyOptions> = {
  [`${proxyBase}/next`]: devProxy(`http://localhost:${ports.next}`, 'next', 'pnpm demo:next'),
  [`${proxyBase}/nuxt`]: devProxy(`http://localhost:${ports.nuxt}`, 'nuxt', 'pnpm demo:nuxt'),
  [`${proxyBase}/sveltekit`]: devProxy(
    `http://localhost:${ports.sveltekit}`,
    'sveltekit',
    'pnpm demo:sveltekit',
  ),
  [`${proxyBase}/astro`]: {
    ...devProxy(`http://localhost:${ports.astro}`, 'astro', 'pnpm demo:astro'),
    // Astro uses the incoming host to keep its dev assets on the browser's site.
    changeOrigin: false,
  },
};

/**
 * Empty proxy for `vite preview`. Preview serves the prebuilt `demo/dist`, which
 * already contains the statically-exported next/ and nuxt/ folders. Vite defaults
 * `preview.proxy` to `server.proxy`, which would proxy `/next` … to dev servers
 * that aren't running and answer every link with the {@link devProxy} 502; an
 * empty map lets those paths fall through to the static files.
 */
export const previewProxy: Record<string, ProxyOptions> = {};
