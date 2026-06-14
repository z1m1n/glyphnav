import { View } from './View';

export default function Home() {
  return (
    <View
      title="home"
      body="Next.js App Router edition. A GlyphnavProvider in the root layout shares one controller across every route; each GlyphnavLink wraps next/link and decodes the URL. App Router navigations are async, so this demo defaults to commit: 'animate first' — the bar decodes, then the route swaps."
    />
  );
}
