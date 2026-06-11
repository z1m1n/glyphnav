/**
 * Built-in glyph pools used to fill the "noise" characters while a URL is being
 * scrambled. Pick one, combine them, or pass your own string of characters.
 *
 * Note on the address bar: glyphs that are not URL-safe (anything outside
 * `A-Z a-z 0-9 - . _ ~` plus a handful of sub-delims) get percent-encoded by the
 * browser when written via `history.replaceState`, e.g. `#` shows up as `%23`.
 * For a clean look in the address bar prefer {@link URL_SAFE}. For an on-page
 * effect (a custom URL display element) any charset is fine.
 */

/** Lower + upper case letters, digits, and the URL-safe `-` and `_`. The default. */
export const URL_SAFE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';

/** Letters and digits only. */
export const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Lower-case letters only — calm, word-like noise. */
export const LOWER_ALPHA = 'abcdefghijklmnopqrstuvwxyz';

/** Hexadecimal digits — a "machine code" feel. */
export const HEX = '0123456789abcdef';

/** Punctuation / ASCII symbols — a classic "glitch" feel (gets percent-encoded). */
export const SYMBOLS = '!@#$%^&*()_+-=[]{};:,.<>?/|~';

/** Half-width katakana + digits — the "matrix rain" feel (gets percent-encoded). */
export const MATRIX = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789';

/** Binary — the most reductive option. */
export const BINARY = '01';

/** The charset used when none is provided. */
export const DEFAULT_CHARSET = URL_SAFE;
