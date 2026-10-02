import { expect, test } from '@playwright/test';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubOpportunisticSync,
} from './browser-diagnostics';

test('retirement result exposes initial and terminal monthly rows', async ({ page }, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
  await page.goto('/retirement', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();

  const disclosure = page.locator('details').filter({
    has: page.locator('summary', { hasText: 'Monthly balance and withdrawals' }),
  });
  await expect(disclosure).toBeVisible();
  await disclosure.locator('summary').click();
  const rows = disclosure.getByRole('row');
  await expect.poll(() => rows.count()).toBeGreaterThan(2);
  await expect(rows.nth(1)).toContainText('0');
  await expect(rows.last()).toContainText(/\d{4}-\d{2}-\d{2}/);
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});
