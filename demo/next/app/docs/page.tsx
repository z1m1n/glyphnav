import type { ReactNode } from 'react';
import { DOCS_INSTALL, highlight } from '@glyphnav-demo/shared';

const DOCS_SETUP = `// app/providers.tsx  ('use client')
import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/next';

<GlyphnavProvider duration={250} commit="before" routerMode="app">
  <GlyphnavLink href="/about?tab=2#top">About</GlyphnavLink>
</GlyphnavProvider>;

// imperative, mirrors useRouter().push:
const navigate = useGlyphnavNavigate();
await navigate('/dashboard');`;

const DOCS_VARIANTS = `// Pages Router? Flip one option — the adapter then drives
// next/compat/router instead of next/navigation:
<GlyphnavProvider routerMode="pages">…</GlyphnavProvider>

// Served under a base path? Pass it so commit: 'after' stays accurate:
<GlyphnavProvider basePath="/glyphnav/next">…</GlyphnavProvider>`;

const DOCS_OPTIONS = `<GlyphnavProvider
  duration={250}        // total animation time (ms), spread over all frames
  effect="scramble"     // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit="before"       // navigate instantly, animate on top ('after' = classic order)
  routerMode="app"      // 'app' (next/navigation) or 'pages' (next/compat/router)
  scope="tail"          // animate only the part that differs from the current path
  animatePopState       // also animate browser back/forward (opt-in)
>`;

/** A code listing as a captioned <figure>. */
function Figure({
  code,
  caption,
  captionId,
}: {
  code: string;
  caption?: ReactNode;
  captionId?: string;
}) {
  return (
    <figure>
      {caption ? <figcaption id={captionId}>{caption}</figcaption> : null}
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
    </figure>
  );
}

export default function Docs() {
  return (
    <div className="view docs">
      <article>
        <header className="lead">
          <h2>Docs</h2>
          Install the package — Next.js stays a peer dependency:
        </header>
        <Figure code={DOCS_INSTALL} />
        <Figure
          caption={
            <>
              <code>GlyphnavLink</code> is a drop-in for <code>next/link</code>; nothing is patched
              globally:
            </>
          }
          code={DOCS_SETUP}
        />
        <Figure
          caption="One adapter, both Next routers (App or Pages) — and base-path aware:"
          code={DOCS_VARIANTS}
        />
        <Figure
          captionId="options"
          caption="Every entry point accepts the same options object:"
          code={DOCS_OPTIONS}
        />
      </article>
    </div>
  );
}
