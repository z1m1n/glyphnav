import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, redirect, RouterProvider, useLocation } from 'react-router';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavNavigate } from 'glyphnav/react-router';

window.glyphResults = [];
const hooks = { onComplete: (_context, result) => window.glyphResults.push(result) };

function Page() {
  const location = useLocation();
  const navigate = useGlyphnavNavigate();
  useEffect(() => {
    window.navigateGlyph = navigate;
  }, [navigate]);
  return (
    <>
      <output id="route">{location.pathname + location.search + location.hash}</output>
      <GlyphnavLink to="/about?q=glyphnav#results">Delayed route</GlyphnavLink>
      <GlyphnavLink to="/redirect">Redirect</GlyphnavLink>
      <GlyphnavLink to="/other" target="_blank">
        New tab
      </GlyphnavLink>
      <GlyphnavLink to="/download.txt" download>
        Download
      </GlyphnavLink>
      <GlyphnavLink to="/about" onClick={(event) => event.preventDefault()}>
        Cancelled link
      </GlyphnavLink>
      <div id="results">Hash destination</div>
    </>
  );
}

const page = (
  <GlyphnavProvider duration={250} charset="xyzw" hooks={hooks}>
    <Page />
  </GlyphnavProvider>
);
const delay = () => new Promise((resolve) => setTimeout(resolve, 80));
const router = createBrowserRouter([
  { path: '/', element: page },
  { path: '/about', loader: delay, element: page },
  { path: '/other', element: page },
  { path: '/landed', element: page },
  {
    path: '/redirect',
    loader: async () => {
      await delay();
      return redirect('/landed?via=redirect');
    },
    element: page,
  },
]);
createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
