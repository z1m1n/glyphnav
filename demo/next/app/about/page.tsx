import { View } from '../View';

export default function About() {
  return (
    <View
      title="About"
      body="GlyphnavLink is a drop-in for next/link's <Link>; useGlyphnavNavigate() is the imperative equivalent of useRouter().push. Deep links with ?query and #hash animate too — they are just part of the path."
    />
  );
}
