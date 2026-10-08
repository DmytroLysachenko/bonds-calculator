import { expect, test } from '@playwright/test';

import { createSavedScenario } from '@/features/single-calculator/lib/scenario-storage';
import { buildFallbackInputs } from '@/features/single-calculator/lib/single-calculator-state';

import { stubOpportunisticSync } from './browser-diagnostics';

async function useEnglish(page: import('@playwright/test').Page) {
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
}

test('V09: comparison presents a scanable three-step setup before the run', async ({ page }) => {
  await useEnglish(page);
  await page.setViewportSize({ width: 1903, height: 900 });
  await page.goto('/compare', { waitUntil: 'networkidle' });
  const order = page.getByRole('navigation', { name: 'Comparison setup order' });
  await expect(order.locator('a')).toHaveCount(3);
  await expect(order.locator('a').nth(0)).toHaveAttribute('href', '#comparison-shared-setup');
  await expect(order.locator('a').nth(1)).toHaveAttribute('href', '#comparison-scenarios-setup');
  await expect(order.locator('a').nth(2)).toHaveAttribute('href', '#comparison-assumptions-setup');
  const box = await order.boundingBox();
  expect(box?.y).toBeLessThan(900);
  expect(box?.height ?? 0).toBeLessThan(90);
  await expect(page.getByText('Review the receipt above, then run one comparison.')).toBeVisible();
});

test('V10: education choices expose trade-offs and every family has a short return', async ({
  page,
}) => {
  await useEnglish(page);
  await page.goto('/education', { waitUntil: 'networkidle' });
  const choices = page.locator('#choose-a-path');
  await expect(choices.locator('a')).toHaveCount(4);
  await expect(choices).toContainText('inflation');
  await expect(choices).toContainText('early exit');
  await expect(choices).toContainText('800+');
  await expect(choices).toContainText(/sale window|issue availability/);
  const index = page.getByRole('navigation', { name: 'On this page' });
  await expect(index.locator('a[href="#education-compare"]')).toBeVisible();
  for (const family of ['fixed', 'reference', 'inflation', 'family']) {
    const section = page.locator(`#offers-${family}`);
    await expect(section.locator('a[href="#choose-a-path"]')).toBeVisible();
    await expect(section.locator('a[href="/compare"]')).toBeVisible();
  }
  const emptyIssues = page
    .getByRole('status')
    .filter({ hasText: 'No issued-series records are available.' });
  await expect(emptyIssues.locator('a[href="#choose-a-path"]')).toBeVisible();

  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'pl', domain: '127.0.0.1', path: '/' }]);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText('Oszczędzasz długoterminowo', { exact: true })).toBeVisible();
});

test('V11: decision guidance is body-sized and semantic text contrast survives both themes', async ({
  page,
}) => {
  await useEnglish(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('bonds-calculator-theme', value), theme);
    await page.reload({ waitUntil: 'networkidle' });
    const guide = page.getByTestId('home-decision-slip').locator('ol a span.text-base').first();
    expect(
      await guide.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    const contrast = await page.evaluate(() => {
      const sample = document.createElement('span');
      sample.style.color = 'hsl(var(--muted-foreground))';
      sample.style.backgroundColor = 'hsl(var(--background))';
      document.body.append(sample);
      const style = getComputedStyle(sample);
      const channel = (color: string) =>
        color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      const luminance = (channels: number[]) =>
        channels
          .map((value) => {
            const s = value / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = luminance(channel(style.color));
      const background = luminance(channel(style.backgroundColor));
      sample.remove();
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
  await page.setViewportSize({ width: 683, height: 768 });
  await page.reload({ waitUntil: 'networkidle' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.goto('/single-calculator', { waitUntil: 'networkidle' });
  const guidance = page.locator('.ui-field-description:visible').first();
  await expect(guidance).toBeVisible();
  expect(
    await guidance.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await page.goto('/education', { waitUntil: 'networkidle' });
  const rateRows = page.locator('#bond-EDO dl');
  expect(
    await rateRows.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  const earlyExit = page
    .locator('#bond-EDO')
    .getByText('Early Redemption:', { exact: false })
    .locator('..');
  expect(
    await earlyExit.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await page.goto('/compare', { waitUntil: 'networkidle' });
  const assumptionsProvenance = page.locator(
    'section[aria-labelledby="comparison-draft-receipt-title"] > p',
  );
  expect(
    await assumptionsProvenance.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('bonds-calculator-theme', value), theme);
    await page.goto('/economic-data?series=cpi', { waitUntil: 'networkidle' });
    const tick = page.locator('.recharts-cartesian-axis-tick-value').first();
    await expect(tick).toBeVisible();
    const tickContrast = await tick.evaluate((element) => {
      const values = (color: string) =>
        color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      const luminance = (color: string) =>
        values(color)
          .map((value) => {
            const s = value / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = luminance(getComputedStyle(element).fill);
      const background = luminance(
        getComputedStyle(element.closest('[role="region"]')!).backgroundColor,
      );
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(tickContrast).toBeGreaterThanOrEqual(4.5);
  }
});

test('V12 and V13: navigation and economic controls remain legible at desktop and zoom widths', async ({
  page,
}) => {
  await useEnglish(page);
  for (const width of [1366, 683]) {
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/economic-data?series=cpi&range=10y&scale=readable', {
      waitUntil: 'networkidle',
    });
    await expect(page.getByRole('group', { name: 'Series' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'CPI scale' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Range Data' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('group', { name: 'Range Data' }).getByRole('button', { name: '5Y' }).click();
  await expect(page).toHaveURL(/range=5Y/);
  await page.getByRole('group', { name: 'Series' }).getByRole('button', { name: 'NBP' }).click();
  await expect(page).toHaveURL(/series=nbp/);
  await expect(page).toHaveURL(/range=5Y/);
  await expect(page.getByText('Only for CPI')).toBeVisible();
  await page.getByRole('group', { name: 'Series' }).getByRole('button', { name: 'CPI' }).click();
  await page
    .getByRole('group', { name: 'CPI scale' })
    .getByRole('button', { name: 'Full scale' })
    .click();
  await expect(page).toHaveURL(/scale=full/);
});

test('V12: Polish regular-investment navigation label wraps without clipping', async ({ page }) => {
  await stubOpportunisticSync(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'pl', domain: '127.0.0.1', path: '/' }]);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/regular-investment', { waitUntil: 'networkidle' });
  const desktopLabel = page
    .locator('aside nav a[href="/regular-investment"] span')
    .filter({ hasText: 'Regularne inwestowanie' })
    .first();
  await expect(desktopLabel).toBeVisible();
  expect(await desktopLabel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 683, height: 768 });
  await page.getByRole('button', { name: /Otwórz nawigacj/ }).click();
  const menuLabel = page
    .getByRole('dialog')
    .locator('a[href="/regular-investment"] span')
    .filter({ hasText: 'Regularne inwestowanie' })
    .first();
  await expect(menuLabel).toBeVisible();
  expect(await menuLabel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
});

test('V14: restore is the visible row action and deletion requires confirmation', async ({
  page,
}) => {
  await useEnglish(page);
  const record = createSavedScenario(buildFallbackInputs(new Date('2026-09-29T12:00:00Z')), {
    name: 'Keep this plan',
  });
  await page.addInitScript(
    (value) => localStorage.setItem('obligacje.saved-single-scenarios.v1', JSON.stringify([value])),
    record,
  );
  await page.goto('/single-calculator', { waitUntil: 'networkidle' });
  const library = page.getByRole('region', { name: 'Saved scenarios' });
  await library.getByRole('button', { name: /Show all/ }).click();
  await expect(library.getByRole('button', { name: 'Restore as draft' })).toBeVisible();
  await expect(library.getByRole('button', { name: 'Delete scenario' })).toBeHidden();
  await library.getByText('More actions').click();
  await expect(library.getByRole('button', { name: 'Delete scenario' })).toBeVisible();
  await library.getByRole('button', { name: 'Delete scenario' }).click();
  await expect(library.getByRole('group', { name: 'Confirm scenario deletion' })).toBeVisible();
  await library.getByRole('button', { name: 'Cancel' }).click();
  await expect(library.getByText('Keep this plan')).toBeVisible();
});

test('V15: matching light and dark route states retain readable semantic contrast', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await useEnglish(page);
  for (const width of [1366, 1903]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
    for (const route of [
      '/',
      '/single-calculator',
      '/compare',
      '/regular-investment',
      '/economic-data',
      '/education',
    ]) {
      await page.goto(route, { waitUntil: 'networkidle' });
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate(
          (value) => localStorage.setItem('bonds-calculator-theme', value),
          theme,
        );
        await page.reload({ waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
        const name = (route === '/' ? 'home' : route.slice(1)).replaceAll('/', '-');
        await page.screenshot({
          path: testInfo.outputPath(`${name}-${width}-${theme}.png`),
          fullPage: true,
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        const colors = await page.locator('body').evaluate((element) => {
          const style = getComputedStyle(element);
          return { foreground: style.color, background: style.backgroundColor };
        });
        expect(colors.foreground).not.toBe(colors.background);
      }
    }
  }
});
