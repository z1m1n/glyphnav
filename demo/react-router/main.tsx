import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { GlyphnavProvider } from 'glyphnav/react-router';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL + 'react-router'}>
      <GlyphnavProvider duration={250} commit="before">
        <App />
      </GlyphnavProvider>
    </BrowserRouter>
  </StrictMode>,
);
