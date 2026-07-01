/** @jsxImportSource preact */
import { render } from 'preact';
import { LocationProvider } from 'preact-iso';
import { GlyphnavProvider } from 'glyphnav/preact-iso';
import { App } from './App';

// `interceptLinks` animates the plain `<a>` clicks preact-iso already handles,
// so the demo's nav links decode the URL with no component swap.
//
// `scope` bounds preact-iso's own global link interception to this app's paths,
// so cross-app links (the "glyphnav" title → `/`, the footer's Changelog →
// `/changelog/`) fall through to a real full-page navigation instead of being
// caught as an in-app route (which would land on the fallback). `data-glyphnav`
// only tells glyphnav's interceptor to skip — preact-iso needs its own `scope`.
render(
  <LocationProvider scope={import.meta.env.BASE_URL + 'preact-iso'}>
    <GlyphnavProvider duration={250} commit="before" interceptLinks>
      <App />
    </GlyphnavProvider>
  </LocationProvider>,
  document.getElementById('root')!,
);
