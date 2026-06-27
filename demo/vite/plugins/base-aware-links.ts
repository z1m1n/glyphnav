import type { Plugin } from 'vite';
import { base } from '../paths';

/**
 * Prefix the demo's root-absolute navigation links (`/vanilla/`, `/`) with the
 * deploy base so the picker and the vanilla MPA links work under a project
 * subpath. Vite rewrites `<script src>`/`<link href>` asset references itself but
 * leaves plain anchors alone; `order: 'pre'` runs before that asset resolution,
 * when the only root-absolute hrefs are these navigation links. The negative
 * lookahead leaves protocol-relative `//` URLs untouched. A no-op at the root base.
 *
 * @returns The Vite plugin.
 */
export function baseAwareLinks(): Plugin {
  return {
    name: 'demo-base-aware-links',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (base === '/') return html;
        return html.replace(/href="\/(?!\/)/g, `href="${base}`);
      },
    },
  };
}
