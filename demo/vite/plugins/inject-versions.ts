import type { Plugin } from 'vite';
import { glyphnavVersion, stackForFile, stackTipForFile } from '../versions';

/**
 * Fill the version placeholders in the demo HTML: the library version after the
 * wordmark on the landing page (`__GLYPHNAV_VERSION__`), each demo's
 * framework/router stack in its footer (`__STACK__`), and that footer's hover
 * tooltip (`data-tip="__STACK_TIP__"`). Done at transform time so the numbers
 * always track the installed dependencies.
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

        if (html.includes('__STACK_TIP__')) {
          const tip = stackTipForFile(ctx.filename);
          // No tip for this page (vanilla/core/changelog): drop the whole
          // attribute rather than leave a tooltip with empty text.
          html = tip
            ? html.replace('__STACK_TIP__', tip.replace(/"/g, '&quot;'))
            : html.replace(/\s*data-tip="__STACK_TIP__"/, '');
        }

        return html;
      },
    },
  };
}
