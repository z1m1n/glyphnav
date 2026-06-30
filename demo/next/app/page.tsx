import { View } from './View';

export default function Home() {
  return (
    <View
      title="Home"
      body="Next.js App Router edition. A <code>GlyphnavProvider</code> in the root layout shares one controller across every route; each <code>GlyphnavLink</code> wraps <code>next/link</code> and decodes the URL. App Router navigations are async, so this demo defaults to <code>commit: 'animate first'</code> — the bar decodes, then the route swaps."
    />
  );
}
