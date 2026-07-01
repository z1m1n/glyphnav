/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { LocationProvider, Route, Router, useLocation } from 'preact-iso';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavRoute } from '../src/preact-iso';

const fast = { charset: 'q', rng: () => 0, stepDuration: 5 } as const;

function LocationLabel() {
  const { path } = useLocation();
  return <div data-testid="loc">{path}</div>;
}

function NavButton() {
  const route = useGlyphnavRoute(fast);
  return (
    <button type="button" onClick={() => void route('/test')}>
      go
    </button>
  );
}

const Home = () => <div>home page</div>;
const TestPage = () => <div>test page</div>;
const OtherPage = () => <div>other page</div>;

function App() {
  return (
    <LocationProvider>
      <GlyphnavProvider {...fast}>
        <NavButton />
        <GlyphnavLink href="/other" glyphOptions={fast}>
          other
        </GlyphnavLink>
        <LocationLabel />
        <Router>
          <Route path="/" component={Home} />
          <Route path="/test" component={TestPage} />
          <Route path="/other" component={OtherPage} />
        </Router>
      </GlyphnavProvider>
    </LocationProvider>
  );
}

/** A plain `<a>` (not GlyphnavLink) under `interceptLinks` — the global mode. */
function InterceptApp() {
  return (
    <LocationProvider>
      <GlyphnavProvider {...fast} interceptLinks>
        <a href="/other">plain</a>
        <LocationLabel />
        <Router>
          <Route path="/" component={Home} />
          <Route path="/other" component={OtherPage} />
          <Route default component={Home} />
        </Router>
      </GlyphnavProvider>
    </LocationProvider>
  );
}

describe('preact-iso adapter', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('useGlyphnavRoute animates then navigates', async () => {
    render(<App />);
    expect(screen.getByTestId('loc').textContent).toBe('/');

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/test');
    expect(screen.getByText('test page')).toBeTruthy();
  });

  it('GlyphnavLink animates then navigates once on click', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // A single navigation landed on /other — preact-iso's own global click
    // handler did not fire a second time (GlyphnavLink stops propagation).
    expect(screen.getByTestId('loc').textContent).toBe('/other');
    expect(screen.getByText('other page')).toBeTruthy();
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    render(<App />);

    // Cancel the browser's default navigation for this one click so jsdom does
    // not attempt a full document navigation; GlyphnavLink bails on modified
    // clicks regardless, so the route must stay put.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it('interceptLinks animates a plain <a> click', async () => {
    render(<InterceptApp />);
    expect(screen.getByTestId('loc').textContent).toBe('/');

    fireEvent.click(screen.getByText('plain'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/other');
    expect(screen.getByText('other page')).toBeTruthy();
  });
});
