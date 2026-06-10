import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { GlyphnavLink, useGlyphnavNavigate } from '../src/react-router';

const fast = { charset: 'q', rng: () => 0, stepDuration: 5 } as const;

function LocationLabel() {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname}</div>;
}

function NavButton() {
  const navigate = useGlyphnavNavigate(fast);
  return (
    <button type="button" onClick={() => void navigate('/test')}>
      go
    </button>
  );
}

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <NavButton />
      <GlyphnavLink to="/other" glyphOptions={fast}>
        other
      </GlyphnavLink>
      <LocationLabel />
      <Routes>
        <Route path="/" element={<div>home page</div>} />
        <Route path="/test" element={<div>test page</div>} />
        <Route path="/other" element={<div>other page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('react adapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('useGlyphnavNavigate animates then navigates', async () => {
    render(<App />);
    expect(screen.getByTestId('loc').textContent).toBe('/');

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/test');
    expect(screen.getByText('test page')).toBeTruthy();
  });

  it('GlyphnavLink animates then navigates on click', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/other');
    expect(screen.getByText('other page')).toBeTruthy();
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    render(<App />);

    // Cancel the browser's default navigation for this one click so jsdom does
    // not log an unimplemented full navigation. GlyphnavLink bails on modified
    // clicks regardless, so the route must stay put.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // modified click is not hijacked -> route stays put
    expect(screen.getByTestId('loc').textContent).toBe('/');
  });
});
