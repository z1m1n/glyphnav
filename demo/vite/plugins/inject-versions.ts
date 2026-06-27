import type { Plugin } from 'vite';
import { glyphnavVersion, stackForFile } from '../versions';

/**
 * Fill the version placeholders in the demo HTML: the library version after the
 * wordmark on the landing page (`__GLYPHNAV_VERSION__`) and each demo's
 * framework/router stack in its footer (`__STACK__`). Done at transform time so
 * the numbers always track the installed dependencies.
 *
 * @returns The Vite plugin.
 */
export function injectVersions(): Plugin {
  return {
    name: 'demo-inject-versions',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        html = html.replace('__GLYPHNAV_VERSION__', `v${glyphnavVersion}`);

        if (html.includes('__STACK__')) {
          html = html.replace('__STACK__', stackForFile(ctx.filename));
        }
        
        return html;
      },
    },
  };
}
