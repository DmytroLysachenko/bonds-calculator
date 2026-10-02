import { expect, test } from '@playwright/test';

import { stubOpportunisticSync } from './browser-diagnostics';

for (const width of [1366, 1903]) {
  test(`V07: one calculator entry and two distinct decision paths at ${width}px`, async ({
    page,
  }) => {
    await stubOpportunisticSync(page);
    await page.setViewportSize({ width, height: 900 });
    await page
      .context()
      .addCookies([{ name: 'app-language', value: 'pl', domain: '127.0.0.1', path: '/' }]);
    await page.goto('/', { waitUntil: 'networkidle' });

    const primary = page.locator('main#main-content a[href="/single-calculator"]');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveText(/Zasymuluj obligację/);
    const guide = page.getByTestId('home-decision-slip');
    await expect(guide.locator('a[href="/education"]')).toBeVisible();
    await expect(guide.locator('a[href="/economic-data"]')).toBeVisible();
    await expect(guide.locator('a[href="/single-calculator"]')).toHaveCount(0);
    await expect(guide.locator('button[aria-pressed]')).toHaveCount(0);
    const box = await primary.boundingBox();
    expect(box?.y).toBeLessThan(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

test('V08: recurring plan shows one quantity/PLN pair and discloses full synchronized schedule', async ({
  page,
}) => {
  await stubOpportunisticSync(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'pl', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/regular-investment', { waitUntil: 'networkidle' });

  await expect(page.getByText('Alokacja i benchmark gotówkowy', { exact: true })).toHaveCount(1);

  const quantity = page.getByLabel('Liczba obligacji', { exact: true });
  await expect(quantity).toHaveCount(1);
  await quantity.fill('3');
  await expect(page.getByLabel('Odpowiednik wpłaty (PLN)')).toContainText('300');
  const summary = page.getByTestId('regular-plan-summary');
  await expect(summary).toContainText('Wpłata bazowa na termin');
  await expect(summary).toContainText('300');
  await expect(summary).toContainText('Pierwszy–ostatni przepływ');
  await expect(
    page.getByText('Edytuj dodatki i zobacz pełny harmonogram').locator('xpath=..'),
  ).not.toHaveAttribute('open', '');

  await page.getByText('Dostrój suwakiem').first().click();
  const slider = page.getByRole('slider', { name: 'Dostrój suwakiem' });
  await expect(slider).toHaveAttribute('aria-valuenow', '3');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(page.getByLabel('Odpowiednik wpłaty (PLN)')).toContainText('400');
  await expect(quantity).toHaveValue('4');

  await page.getByText('Edytuj dodatki i zobacz pełny harmonogram').click();
  const fullRows = page.locator('main#main-content table tbody tr');
  expect(await fullRows.count()).toBeGreaterThan(8);
  await expect(summary).toContainText(String(await fullRows.count()));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
