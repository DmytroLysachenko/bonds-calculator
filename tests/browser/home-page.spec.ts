import { expect, test } from '@playwright/test';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubOpportunisticSync,
} from './browser-diagnostics';

const homeRoutes = [
  '/single-calculator',
  '/education',
  '/economic-data',
  '/compare',
  '/regular-investment',
  '/ladder',
  '/notebook',
] as const;

for (const path of homeRoutes) {
  test(`home keeps ${path} discoverable`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);

    await stubOpportunisticSync(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator(`main#main-content a[href="${path}"]`).first()).toBeVisible();
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

test('home primary action opens the single-bond calculator', async ({ page }, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);

  await stubOpportunisticSync(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  const primaryAction = page.getByRole('link', { name: 'Zasymuluj obligację' });
  await expect(primaryAction).toBeVisible();
  await primaryAction.click();
  await expect(page).toHaveURL(/\/single-calculator$/);
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('home keeps the primary action and decision guide in the first viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Mobile prioritizes the decision guide');
  const diagnostics = installBrowserDiagnostics(page);

  await stubOpportunisticSync(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  const [primaryAction, decisionSlip] = await Promise.all([
    page.getByRole('link', { name: 'Zasymuluj obligację' }).boundingBox(),
    page.getByTestId('home-decision-slip').first().boundingBox(),
  ]);

  expect(primaryAction?.y).toBeLessThan(await page.evaluate(() => window.innerHeight));
  expect(decisionSlip?.y).toBeLessThan(await page.evaluate(() => window.innerHeight));
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('home keeps the decision guide available after the primary action on mobile', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-specific layout assertion');
  const diagnostics = installBrowserDiagnostics(page);

  await stubOpportunisticSync(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  const decisionSlip = page.getByTestId('home-decision-slip');
  const primaryAction = page.getByRole('link', { name: 'Zasymuluj obligację' });
  await expect(decisionSlip).toBeVisible();
  await expect(primaryAction).toBeVisible();

  const [decisionBox, primaryBox] = await Promise.all([
    decisionSlip.boundingBox(),
    primaryAction.boundingBox(),
  ]);
  expect(primaryBox?.y).toBeLessThan(decisionBox?.y ?? 0);
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});
