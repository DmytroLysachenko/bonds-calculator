import { expect, test } from '@playwright/test';

import { stubOpportunisticSync } from './browser-diagnostics';

test('V03: comparison presents active assumptions and reference freshness before Calculate', async ({
  page,
}) => {
  await stubOpportunisticSync(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.route('**/api/calculation-defaults', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          inflationAsOf: '2026-08-01',
          nbpAsOf: '2026-09-01',
          usedFallback: true,
        },
      }),
    }),
  );
  await page.goto('/compare?a=EDO&b=ROR', { waitUntil: 'networkidle' });

  const receipt = page.getByRole('region', { name: 'Assumptions for this run' });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('EDO');
  await expect(receipt).toContainText('ROR');
  await expect(receipt).toContainText('10,000 PLN');
  await expect(receipt).toContainText('3.5%');
  await expect(receipt).toContainText('5.25%');
  await expect(receipt).toContainText('fallback');
  await expect(receipt).toContainText('1 Aug 2026');
  await expect(receipt).toContainText('1 Sept 2026');
  await expect(receipt.getByRole('link', { name: 'Edit assumptions' })).toHaveAttribute(
    'href',
    '#comparison-assumptions-setup',
  );
  const action = page.getByRole('button', { name: 'Calculate', exact: true });
  expect(
    await page.evaluate(() => {
      const receipt = document.querySelector('#comparison-draft-receipt-title');
      const action = [...document.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Calculate',
      );
      return Boolean(
        receipt &&
        action &&
        receipt.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);
  await action.click();
  await expect(page.getByRole('region', { name: 'Scenario plan' })).toBeVisible();
  await expect(
    page.getByText('These are modeled outcomes under the selected shared assumptions.'),
  ).toBeVisible();
});

test('V04: readable CPI marks clipped peaks and offers full-scale recovery', async ({ page }) => {
  await stubOpportunisticSync(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.route('**/api/charts/inflation', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          data: [
            { date: '2022-01', rate: 2 },
            { date: '2022-02', rate: 3 },
            { date: '2022-03', rate: 14.4 },
            { date: '2022-04', rate: 4 },
            { date: '2022-05', rate: 3.5 },
            { date: '2022-06', rate: 2.5 },
          ],
          source: 'fallback',
          usedFallback: true,
          asOf: '2022-06',
        },
      }),
    }),
  );
  await page.goto('/economic-data?series=cpi&range=10Y&scale=readable', {
    waitUntil: 'networkidle',
  });

  await expect(page.getByTestId('inflation-peak')).toContainText('14.4%');
  await expect(page.getByTestId('inflation-peak')).toContainText('March 2022');
  await expect(page.getByTestId('inflation-clipped-marker')).toHaveCount(1);
  await expect(page.getByText(/Readable scale clips CPI values/).first()).toBeVisible();
  await page.getByTestId('inflation-clipped-marker').hover();
  await expect(page.locator('.ui-chart-tooltip')).toContainText('14.4%');
  const readableLine = await page.locator('.recharts-line-curve').getAttribute('d');
  const fullScaleAction = page.getByRole('button', { name: 'Full scale' }).last();
  await fullScaleAction.click();
  await expect(page).toHaveURL(/scale=full/);
  await expect(page.getByTestId('inflation-clipped-marker')).toHaveCount(0);
  await expect(page.getByTestId('inflation-peak')).toContainText('14.4%');
  await expect
    .poll(() => page.locator('.recharts-line-curve').getAttribute('d'))
    .not.toBe(readableLine);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByTestId('inflation-peak')).toBeVisible();
});
