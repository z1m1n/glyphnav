import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.historyWrites = [];
    const replace = History.prototype.replaceState;
    History.prototype.replaceState = function (...args) {
      replace.apply(this, args);
      window.historyWrites.push(location.pathname + location.search + location.hash);
    };
  });
});

const completed = async (page) => {
  await expect.poll(() => page.evaluate(() => window.glyphResults.at(-1))).toBe('completed');
};

const hasIntermediatePath = async (page, from, to) => {
  const writes = await page.evaluate(() => window.historyWrites);
  expect(writes.some((path) => path !== from && path !== to)).toBe(true);
};

test('a delayed React Router navigation animates the real address bar and preserves query/hash', async ({
  page,
}) => {
  await page.goto('/');
  const initialHistory = await page.evaluate(() => history.length);
  await page.getByText('Delayed route', { exact: true }).click();
  await completed(page);
  await expect(page.locator('#route')).toHaveText('/about?q=glyphnav#results');
  await expect(page).toHaveURL('/about?q=glyphnav#results');
  await hasIntermediatePath(page, '/', '/about?q=glyphnav#results');
  expect(await page.evaluate(() => history.length)).toBe(initialHistory + 1);
});

test('React Router redirects animate to the landed path', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Redirect', { exact: true }).click();
  await completed(page);
  await expect(page).toHaveURL('/landed?via=redirect');
  await hasIntermediatePath(page, '/', '/landed?via=redirect');
});

test('rapid React Router navigation settles both runs at the newest route', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#route')).toHaveText('/');
  const results = await page.evaluate(async () => {
    const first = window.navigateGlyph('/about');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = window.navigateGlyph('/other');
    return Promise.all([first, second]);
  });
  expect(results).toEqual(['cancelled', 'completed']);
  await expect(page).toHaveURL('/other');
  await hasIntermediatePath(page, '/', '/other');
});

test('new-tab, download and cancelled clicks preserve browser behavior', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#route')).toHaveText('/');
  await page.evaluate(() => {
    window.historyWrites = [];
  });
  const popupPromise = page.waitForEvent('popup');
  await page.getByText('New tab', { exact: true }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL('/other');
  await popup.close();
  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Download', { exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('download.txt');
  await page.getByText('Cancelled link', { exact: true }).click();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => window.historyWrites)).toEqual([]);
});

test('reduced motion commits the React Router route without intermediate writes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#route')).toHaveText('/');
  await page.evaluate(() => {
    window.historyWrites = [];
  });
  await page.getByText('Delayed route', { exact: true }).click();
  await expect(page).toHaveURL('/about?q=glyphnav#results');
  expect(await page.evaluate(() => window.historyWrites)).toEqual([]);
});

test('vanilla animate-first navigation leaves back/forward animation enabled', async ({ page }) => {
  await page.goto('/vanilla.html');
  await page.getByText('Destination', { exact: true }).click();
  await completed(page);
  await expect(page).toHaveURL('/destination?q=1#results');
  await hasIntermediatePath(page, '/vanilla.html', '/destination?q=1#results');
  await page.evaluate(() => {
    window.historyWrites = [];
    window.glyphResults = [];
  });
  await page.goBack();
  await completed(page);
  await expect(page).toHaveURL('/vanilla.html');
  await hasIntermediatePath(page, '/destination?q=1#results', '/vanilla.html');
});
