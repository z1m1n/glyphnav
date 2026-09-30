/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { LocationProvider, Route, Router, useLocation } from 'preact-iso';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavRoute } from '../src/preact-iso';
import { GlyphnavController } from '../src/core';

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
    vi.restoreAllMocks();
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

  it.each([
    { target: '_blank' },
    { download: '' },
    { rel: 'external' },
    { href: 'https://external.example/path' },
  ])('preserves native behavior for browser-owned GlyphnavLink: %j', (attributes) => {
    const run = vi.spyOn(GlyphnavController.prototype, 'run');
    render(
      <LocationProvider>
        <GlyphnavProvider {...fast}>
          <GlyphnavLink href="/other" {...attributes}>
            native
          </GlyphnavLink>
        </GlyphnavProvider>
      </LocationProvider>,
    );
    const link = screen.getByText('native');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(window.location.pathname).toBe('/');
  });

  it('honors onClick cancellation before starting a run', () => {
    const run = vi.spyOn(GlyphnavController.prototype, 'run');
    render(
      <LocationProvider>
        <GlyphnavProvider {...fast}>
          <GlyphnavLink href="/other" onClick={(event) => event.preventDefault()}>
            cancel
          </GlyphnavLink>
        </GlyphnavProvider>
      </LocationProvider>,
    );
    fireEvent.click(screen.getByText('cancel'));
    expect(run).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
  });

  it('lets opted-out internal links use native preact-iso navigation', () => {
    const run = vi.spyOn(GlyphnavController.prototype, 'run');
    render(
      <LocationProvider>
        <GlyphnavProvider {...fast} interceptLinks>
          <GlyphnavLink href="/other" data-glyphnav="off">
            opt-out
          </GlyphnavLink>
        </GlyphnavProvider>
      </LocationProvider>,
    );
    fireEvent.click(screen.getByText('opt-out'));
    expect(run).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/other');
  });

  it('protects empty download and cancelled plain links from the preact-iso listener', () => {
    const run = vi.spyOn(GlyphnavController.prototype, 'run');
    render(
      <LocationProvider>
        <GlyphnavProvider {...fast} interceptLinks>
          <a href="/other" download="">
            download
          </a>
          <a href="/other" onClick={(event) => event.preventDefault()}>
            cancel-plain
          </a>
        </GlyphnavProvider>
      </LocationProvider>,
    );
    fireEvent.click(screen.getByText('download'));
    expect(window.location.pathname).toBe('/');
    fireEvent.click(screen.getByText('cancel-plain'));
    expect(window.location.pathname).toBe('/');
    expect(run).not.toHaveBeenCalled();
  });

  it('applies glyphOptions under a provider and keeps the shared base options', async () => {
    const localFrames: string[] = [];
    const sharedFrames: string[] = [];
    render(
      <LocationProvider>
        <GlyphnavProvider
          {...fast}
          stepDuration={20}
          hooks={{ onFrame: (frame) => sharedFrames.push(frame.path) }}
        >
          <GlyphnavLink
            href="/other"
            glyphOptions={{
              commit: 'after',
              charset: 'z',
              stepDuration: 20,
              hooks: { onFrame: (frame) => localFrames.push(frame.path) },
            }}
          >
            local
          </GlyphnavLink>
          <GlyphnavLink href="/test">shared</GlyphnavLink>
        </GlyphnavProvider>
      </LocationProvider>,
    );
    fireEvent.click(screen.getByText('local'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(localFrames[0]).toBe('/z');
    expect(localFrames.at(-1)).toBe('/other');
    expect(sharedFrames).toHaveLength(0);
    fireEvent.click(screen.getByText('shared'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(sharedFrames[0]).toBe('/q');
    expect(sharedFrames.at(-1)).toBe('/test');
  });

  it('cancels provider-owned animations when the provider is unmounted', async () => {
    const onFrame = vi.fn();
    const view = render(
      <LocationProvider>
        <GlyphnavProvider {...fast} commit="after" hooks={{ onFrame }}>
          <GlyphnavLink href="/other">go-away</GlyphnavLink>
        </GlyphnavProvider>
      </LocationProvider>,
    );
    fireEvent.click(screen.getByText('go-away'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });
    expect(onFrame).toHaveBeenCalled();
    view.unmount();
    onFrame.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onFrame).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
  });
});
