import { defineMiddleware } from 'astro:middleware';
import { ports } from '../../ports';

// Astro's dev modules use root URLs even when pages have a base. Keep those
// modules on Astro's port while preserving the browser's hostname, so requests
// from the picker stay same-site.
export const onRequest = defineMiddleware(async ({ url }, next) => {
  const response = await next();
  if (!import.meta.env.DEV || !response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }

  const assetOrigin = new URL(url.origin);
  assetOrigin.port = String(ports.astro);
  const html = (await response.text()).replace(
    /\b(src|href)=(["'])(\/(?:@|src\/)[^"']*)\2/g,
    (_match, attribute, quote, path) => `${attribute}=${quote}${assetOrigin.origin}${path}${quote}`,
  );
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
});
