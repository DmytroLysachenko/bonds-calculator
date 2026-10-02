import { expect, Page, test } from '@playwright/test';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubOpportunisticSync,
} from './browser-diagnostics';

async function openOfferComparison(page: Page) {
  const disclosure = page
    .locator('details')
    .filter({ has: page.getByText('Porównaj wybrane', { exact: true }) });
  await disclosure.locator('summary').click();
  await expect(disclosure).toHaveAttribute('open', '');
  return disclosure;
}

test('education compares two selected offers in table order without browser diagnostics', async ({
  page,
}, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);

  await stubOpportunisticSync(page);
  await page.goto('/education', { waitUntil: 'networkidle' });

  const comparison = await openOfferComparison(page);
  const checkboxes = comparison.getByRole('checkbox');
  await checkboxes.nth(1).check();
  await checkboxes.nth(0).check();

  await expect(page.getByText(/Wybrano: 2/)).toBeVisible();
  const compareSelected = comparison.getByRole('link', { name: 'Porównaj wybrane' });
  await expect(compareSelected).toHaveAttribute('href', '/compare?a=OTS&b=TOS');
  await expect(checkboxes.nth(2)).toBeDisabled();
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('education comparison table remains keyboard-focusable and horizontally scrollable on mobile', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-specific interaction assertion');
  const diagnostics = installBrowserDiagnostics(page);

  await stubOpportunisticSync(page);
  await page.goto('/education', { waitUntil: 'networkidle' });

  const comparison = await openOfferComparison(page);
  const scrollRegion = comparison.locator('.ui-table-scroll-region');
  await scrollRegion.focus();
  await expect(scrollRegion).toBeFocused();
  expect(await scrollRegion.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );

  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});
