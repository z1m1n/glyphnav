import { expect, test } from '@playwright/test';

const base = '/glyphnav/astro/';

async function setup(page, commit, backForward = false) {
  await page.addInitScript(
    ({ commit: timing, backForward: historyAnimation }) => {
      localStorage.setItem(
        'glyphnav-demo:astro',
        JSON.stringify({
          charset: 'hex',
          duration: 250,
          effect: 'decode',
          commit: timing,
          scope: 'full',
          backForward: historyAnimation,
        }),
      );
      window.documentToken = Math.random();
      window.historyWrites = [];
      const replace = History.prototype.replaceState;
      History.prototype.replaceState = function (...args) {
        replace.apply(this, args);
        window.historyWrites.push(location.pathname + location.search + location.hash);
      };
    },
    { commit, backForward },
  );
  await page.goto(base);
  await expect(page.locator('#commit')).toHaveValue(commit);
  await page.evaluate(() => {
    window.historyWrites = [];
  });
}

async function settled(page, destination) {
  await expect
    .poll(
      () => new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash,
    )
    .toBe(destination);
  await expect(page.locator('.path')).toHaveText(destination);
  await expect(page.locator('.bar')).not.toHaveClass(/resolving/);
}

for (const commit of ['before', 'after']) {
  test(`ClientRouter links animate across document swaps with commit:${commit}`, async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await setup(page, commit);
    const token = await page.evaluate(() => window.documentToken);
    await page.getByRole('link', { name: '?query', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    await settled(page, `${base}about/?ref=deep&page=2`);
    expect(await page.evaluate(() => window.documentToken)).toBe(token);
    const writes = await page.evaluate(() => window.historyWrites);
    // A busy worker may coalesce overdue frames into one intermediate state.
    expect(
      writes.filter((path) => ![base, `${base}about/?ref=deep&page=2`].includes(path)).length,
    ).toBeGreaterThan(0);
    await expect(page.locator('.deep a[aria-current="true"]')).toHaveText('?query');

    // Controls remain live after Astro has replaced the body.
    await page.locator('#effect').selectOption('scramble');
    await page.getByRole('link', { name: '#hash', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Docs', exact: true })).toBeVisible();
    await settled(page, `${base}docs/#options`);
    await expect(page.locator('#effect')).toHaveValue('scramble');
    await expect(page.locator('.code-copy')).toHaveCount(4);
    await expect(page.locator('.theme-toggle')).toHaveCount(1);
    await page.locator('.theme-toggle').click();
    await page.getByRole('link', { name: '?query+#hash', exact: true }).click();
    await settled(page, `${base}about/?q=glyph#results`);
    await expect(page.locator('#commit')).toHaveValue(commit);
    await expect(page.locator('.theme-toggle')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('ClientRouter preserves replace history and opt-in back/forward', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page, 'before', true);
  const initialLength = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: 'Features', exact: true }).click();
  await settled(page, `${base}features/`);
  await page.getByRole('link', { name: 'Replace this history entry', exact: true }).click();
  await settled(page, `${base}about/`);
  expect(await page.evaluate(() => history.length)).toBe(initialLength + 1);
  await page.evaluate(() => {
    window.historyWrites = [];
  });
  await page.goBack();
  await settled(page, base);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect((await page.evaluate(() => window.historyWrites)).length).toBeGreaterThan(1);
  await page.goForward();
  await settled(page, `${base}about/`);
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Astro starts from the picker with working controls and ClientRouter navigation', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  const pickerOrigin = 'http://localhost:5189';
  await page.goto(`${pickerOrigin}/glyphnav/`);
  await page.locator('a[href="/glyphnav/astro/"]').click();
  await expect(page.locator('.theme-toggle')).toHaveCount(1);
  await expect(page.locator('.tabs a[aria-current="page"]')).toHaveText('Home');
  const moduleUrls = await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src));
  expect(moduleUrls.length).toBeGreaterThan(0);
  for (const moduleUrl of moduleUrls) {
    expect(new URL(moduleUrl).origin).toBe('http://localhost:5188');
  }
  await page.locator('#commit').selectOption('after');
  await page.locator('#effect').selectOption('scramble');
  await page.evaluate(() => {
    window.documentToken = Math.random();
  });
  const token = await page.evaluate(() => window.documentToken);

  await page.getByRole('link', { name: '?query', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await settled(page, `${base}about/?ref=deep&page=2`);
  expect(new URL(page.url()).origin).toBe(pickerOrigin);
  expect(await page.evaluate(() => window.documentToken)).toBe(token);
  await expect(page.locator('#effect')).toHaveValue('scramble');

  await page.getByRole('link', { name: '#hash', exact: true }).click();
  await settled(page, `${base}docs/#options`);
  await expect(page.locator('.code-copy')).toHaveCount(4);
  await page.locator('.theme-toggle').click();
  expect(errors).toEqual([]);
});
