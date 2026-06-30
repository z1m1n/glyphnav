import { View } from '../View';

export default function About() {
  return (
    <View
      title="About"
      body={`<code>GlyphnavLink</code> is a drop-in for next/link's <code>&lt;Link&gt;</code>; <code>useGlyphnavNavigate()</code> is the imperative equivalent of <code>useRouter().push</code>. Deep links with <code>?query</code> and <code>#hash</code> animate too — they are just part of the path. Heads up: each frame writes via <code>history.replaceState</code>, so back/forward stays untouched, but your browser's own URL history/autocomplete can still log every frame — see the docs for how to keep that in check.`}
    />
  );
}
