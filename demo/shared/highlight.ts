/**
 * Syntax highlighting for the docs code blocks — a thin wrapper over
 * `sugar-high` (~1 kB gzipped), so every demo keeps its `highlight` import
 * while the tokenizer itself lives in the library.
 *
 * `highlight(code)` tokenizes a JS/TS/JSX snippet and returns an HTML string of
 * `<span class="sh__token--*">` wrappers, ready to drop inside a `<code>`
 * element. Every token's text is HTML-escaped, so the output is safe to inject
 * (innerHTML / dangerouslySetInnerHTML / Angular [innerHTML]). Token colours
 * come from the `.sh__token--*` rules in ./styles.css (via the `--sh-*` custom
 * properties, once for light and once for dark).
 *
 * A `lang` hint switches to a tiny markup highlighter for tag chips — sugar-high
 * is JS/JSX-only and mis-reads a custom element like `<router-link>` (the hyphen
 * parses as a minus, splitting the name into two mismatched colours).
 */
import { highlight as sugarHighlight } from 'sugar-high';

/**
 * Highlight a code snippet into HTML safe to place inside `<code>`.
 *
 * @param code - The snippet to tokenize.
 * @param lang - Optional language hint (a chip's `data-lang`). `html` / `vue` /
 *   `svelte` / `xml` / `svg` / `markup` use the tag-aware highlighter; anything
 *   else (the default) uses sugar-high's JS/TS/JSX tokenizer.
 */
export function highlight(code: string): string {
  // sugar-high inlines `style="color:var(--sh-*)"` on every token span. The
  // ./styles.css class rules already set the same colours, so the inline copy
  // is dead weight in the prerendered HTML — and Angular's [innerHTML]
  // sanitizer strips it with a console warning per code block. Drop it here;
  // if sugar-high ever reshapes the attribute, the classes still colour
  // everything and this replace merely becomes a no-op.
  return sugarHighlight(code).replaceAll(/ style="color:var\(--sh-[a-z]+\)"/g, '');
}
