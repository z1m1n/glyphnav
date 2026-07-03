import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { fromDemoRoot } from '../paths';

/**
 * Inline the framework marks on the picker. Each icon lives as its own file in
 * `shared/icons/`; the page only carries `<span class="card-icon"
 * data-icon="react">` placeholders. The matching SVG is read and spliced in, with
 * the placeholder's classes plus `aria-hidden` grafted onto the root `<svg>`.
 * Gradient and clip-path ids are namespaced per inlined instance, so an icon used
 * by two cards (react, solid) can't emit duplicate ids or cross-wire its
 * `url(#…)` references. A no-op on pages without such placeholders.
 *
 * @returns The Vite plugin.
 */
export function inlineIcons(): Plugin {
  const cache = new Map<string, string>();
  const load = (name: string): string => {
    let svg = cache.get(name);

    if (svg === undefined) {
      svg = readFileSync(fromDemoRoot(`shared/icons/${name}.svg`), 'utf8').trim();
      cache.set(name, svg);
    }

    return svg;
  };
  let seq = 0;
  return {
    name: 'demo-inline-icons',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(
          /<span\b([^>]*?)\sdata-icon="([^"]+)"([^>]*)><\/span>/g,
          (_m, pre: string, name: string, post: string) => {
            const cls = /class="([^"]*)"/.exec(`${pre} ${post}`)?.[1] ?? '';
            const ns = `i${seq++}`;

            return load(name)
              .replace(
                /(\bid="|url\(#|href="#)([\w-]+)/g,
                (_s, lead: string, id: string) => `${lead}${ns}-${id}`,
              )
              .replace(/^<svg\b/, `<svg class="${cls}" aria-hidden="true"`)
              .replace(/\sxmlns="[^"]*"/, '');
          },
        );
      },
    },
  };
}
