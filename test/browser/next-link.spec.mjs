import { expect, test } from '@playwright/test';

for (const commit of ['before', 'after']) {
  test(`native Next Link renders the query destination and animates with commit:${commit}`, async ({
    page,
  }) => {
    await page.addInitScript((timing) => {
      localStorage.setItem(
        'glyphnav-demo:next',
        JSON.stringify({
          charset: 'hex',
          duration: 250,
          effect: 'decode',
          commit: timing,
          scope: 'full',
          backForward: false,
        }),
      );
      window.historyWrites = [];
      const replace = History.prototype.replaceState;
      History.prototype.replaceState = function (...args) {
        replace.apply(this, args);
        window.historyWrites.push(location.pathname + location.search + location.hash);
      };
    }, commit);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/next/');
    // Wait for the client toolbar restoration, not merely server markup.
    await expect(page.locator('.controls select').nth(2)).toHaveValue(commit);
    await page.evaluate(() => {
      window.historyWrites = [];
    });
    await page.getByRole('link', { name: '?query', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname.replace(/\/$/, '')).toBe('/next/about');
    await expect.poll(() => new URL(page.url()).search).toBe('?ref=deep&page=2');
    await expect(page.locator('.bar')).not.toHaveClass(/resolving/);
    const writes = await page.evaluate(() => window.historyWrites);
    // Native Next bookkeeping can write either trailing-slash form; exclude
    // both so only a genuine intermediate animated path satisfies the test.
    const resting = ['/next/', '/next/about?ref=deep&page=2', '/next/about/?ref=deep&page=2'];
    expect(writes.filter((path) => !resting.includes(path)).length).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });
}
