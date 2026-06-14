import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';

// Hoisted so the (hoisted) vi.mock factories below can reference them.
const m = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  pagesPush: vi.fn(),
  pagesReplace: vi.fn(),
}));

// next/link → a plain <a> that forwards href + onClick (enough to drive clicks).
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, onClick, children, ...rest }: Record<string, unknown>) =>
    createElement(
      'a',
      { href: typeof href === 'string' ? href : '#', onClick, ...rest },
      children as never,
    ),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: m.push, replace: m.replace }) }));
vi.mock('next/compat/router', () => ({
  useRouter: () => ({ push: m.pagesPush, replace: m.pagesReplace }),
}));

import { GlyphnavLink, GlyphnavProvider, useGlyphnavNavigate } from '../src/next';

// commit: 'after' so the animation plays to completion (memory/jsdom has no real
// landed URL for navigate-first); deterministic, fast frames.
const fast = { charset: 'q', rng: () => 0, stepDuration: 5, commit: 'after' } as const;

function NavButton({ mode }: { mode?: 'app' | 'pages' }) {
  const navigate = useGlyphnavNavigate({ ...fast, routerMode: mode });
  return (
    <button type="button" onClick={() => void navigate('/test')}>
      go
    </button>
  );
}

describe('next adapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('useGlyphnavNavigate animates then pushes via the App Router', async () => {
    render(<NavButton />);

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.push).toHaveBeenCalledWith('/test', undefined);
    expect(m.pagesPush).not.toHaveBeenCalled();
  });

  it("routerMode: 'pages' routes navigation through next/compat/router", async () => {
    render(<NavButton mode="pages" />);

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.pagesPush).toHaveBeenCalledWith('/test', undefined, undefined);
    expect(m.push).not.toHaveBeenCalled();
  });

  it('GlyphnavLink animates then navigates on click', async () => {
    render(
      <GlyphnavProvider {...fast}>
        <GlyphnavLink href="/other">other</GlyphnavLink>
      </GlyphnavProvider>,
    );

    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.push).toHaveBeenCalledWith('/other', expect.anything());
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    render(
      <GlyphnavProvider {...fast}>
        <GlyphnavLink href="/other">other</GlyphnavLink>
      </GlyphnavProvider>,
    );

    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.push).not.toHaveBeenCalled();
  });
});
