/**
 * jsdom cannot perform real document navigation and prints a noisy
 * "Not implemented: navigation to another Document" line whenever a test lets a
 * click fall through to the browser. It is harmless — drop just that line at the
 * stderr level (the only channel that reliably catches it across jsdom/vitest
 * versions) so genuine failures stay visible.
 */
const realWrite = process.stderr.write.bind(process.stderr);

process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
  const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  if (text.includes('Not implemented: navigation')) return true;
  // @ts-expect-error pass through the original (overloaded) signature
  return realWrite(chunk, ...rest);
}) as typeof process.stderr.write;

// jsdom has no scrollTo; TanStack Router's scroll restoration calls it on
// every navigation.
window.scrollTo = (() => {}) as typeof window.scrollTo;
