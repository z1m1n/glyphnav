/**
 * Tiny, dependency-free syntax highlighter for the docs code blocks.
 *
 * It tokenizes a JS/TS-ish snippet and returns an HTML string with
 * `<span class="tok-*">` wrappers, ready to drop inside a `<code>` element.
 * Deliberately minimal — comments, strings, numbers and keywords are enough to
 * read at a glance. Every token's text is HTML-escaped, so the output is safe
 * to inject (innerHTML / dangerouslySetInnerHTML / Angular [innerHTML]).
 */

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'default',
  'const',
  'let',
  'var',
  'await',
  'async',
  'function',
  'return',
  'new',
  'class',
  'extends',
  'interface',
  'type',
  'enum',
  'if',
  'else',
  'for',
  'while',
  'of',
  'in',
  'typeof',
  'void',
  'this',
  'true',
  'false',
  'null',
  'undefined',
]);

const escapeHtml = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const span = (cls: string, text: string): string =>
  `<span class="${cls}">${escapeHtml(text)}</span>`;

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdentStart = (c: string): boolean => /[A-Za-z_$]/.test(c);
const isIdentPart = (c: string): boolean => /[\w$]/.test(c);

/** Highlight a code snippet into HTML safe to place inside `<code>`. */
export function highlight(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;

  while (i < n) {
    const c = code[i];

    // line comment: // … to end of line
    if (c === '/' && code[i + 1] === '/') {
      let j = i + 2;
      while (j < n && code[j] !== '\n') j++;
      out += span('tok-comment', code.slice(i, j));
      i = j;
      continue;
    }

    // string: '…', "…" or `…` (respecting backslash escapes)
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n && code[j] !== c) {
        if (code[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, n); // include the closing quote
      out += span('tok-string', code.slice(i, j));
      i = j;
      continue;
    }

    // number
    if (isDigit(c)) {
      let j = i + 1;
      while (j < n && /[\d._]/.test(code[j])) j++;
      out += span('tok-number', code.slice(i, j));
      i = j;
      continue;
    }

    // identifier / keyword
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(code[j])) j++;
      const word = code.slice(i, j);
      out += KEYWORDS.has(word) ? span('tok-keyword', word) : escapeHtml(word);
      i = j;
      continue;
    }

    // anything else: punctuation, whitespace
    out += escapeHtml(c);
    i++;
  }

  return out;
}
