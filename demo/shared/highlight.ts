/**
 * Tiny, dependency-free syntax highlighter for the docs code blocks.
 *
 * It tokenizes a JS/TS-ish snippet and returns an HTML string with
 * `<span class="tok-*">` wrappers, ready to drop inside a `<code>` element.
 * The token kinds — keyword, function, type, constant, literal, string,
 * number, property, operator and comment — are enough to read a snippet at a
 * glance. Every token's text is HTML-escaped, so the output is safe to inject
 * (innerHTML / dangerouslySetInnerHTML / Angular [innerHTML]).
 */

// Control-flow and declaration keywords.
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
]);

// Value literals — colored apart from the control keywords above.
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'this']);

const escapeHtml = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const span = (cls: string, text: string): string =>
  `<span class="${cls}">${escapeHtml(text)}</span>`;

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdentStart = (c: string): boolean => /[A-Za-z_$]/.test(c);
const isIdentPart = (c: string): boolean => /[\w$]/.test(c);
const isSpace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const isOperator = (c: string): boolean => '=!<>+-*/%&|^~?:'.includes(c);

// ALL_CAPS identifier (MATRIX, URL_SAFE) — at least one letter, length > 1.
const isConstant = (w: string): boolean =>
  /^[A-Z0-9_]+$/.test(w) && /[A-Z]/.test(w) && w.length > 1;

/** Highlight a code snippet into HTML safe to place inside `<code>`. */
export function highlight(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;

  // First non-space char at/after `idx`, and last non-space char before `idx` —
  // used to tell a call (`name(`) from a member (`.name`) from a plain word.
  const nextNonSpace = (idx: number): string => {
    let k = idx;
    while (k < n && isSpace(code[k])) k++;
    return k < n ? code[k] : '';
  };
  const prevNonSpace = (idx: number): string => {
    let k = idx - 1;
    while (k >= 0 && isSpace(code[k])) k--;
    return k >= 0 ? code[k] : '';
  };

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

    // block comment: /* … */
    if (c === '/' && code[i + 1] === '*') {
      let j = i + 2;
      while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++;
      j = Math.min(j + 2, n); // include the closing */
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

    // identifier → keyword / literal / function / property / constant / type
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(code[j])) j++;
      const word = code.slice(i, j);
      let cls = '';
      if (KEYWORDS.has(word)) cls = 'tok-keyword';
      else if (LITERALS.has(word)) cls = 'tok-literal';
      else if (nextNonSpace(j) === '(') cls = 'tok-function';
      else if (prevNonSpace(i) === '.') cls = 'tok-property';
      else if (isConstant(word)) cls = 'tok-constant';
      else if (/^[A-Z]/.test(word)) cls = 'tok-type';
      out += cls ? span(cls, word) : escapeHtml(word);
      i = j;
      continue;
    }

    // operator (=, =>, <, >, :, …) — one char at a time, same class
    if (isOperator(c)) {
      out += span('tok-operator', c);
      i++;
      continue;
    }

    // anything else: structural punctuation, whitespace
    out += escapeHtml(c);
    i++;
  }

  return out;
}
