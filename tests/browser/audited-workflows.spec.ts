import { expect, test } from '@playwright/test';

import { BondType } from '@/features/bond-core/types';
import { buildDefaultSharedConfig } from '@/features/comparison-engine/lib/comparison-calculator-state';
import { withComparisonUrlState } from '@/features/comparison-engine/lib/comparison-deep-link';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubOpportunisticSync,
} from './browser-diagnostics';

const auditedRoutes = ['/regular-investment', '/ladder', '/notebook', '/compare'] as const;

for (const route of auditedRoutes) {
  test(`${route} keeps one visible page title at desktop width`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await stubOpportunisticSync(page);
    await page.goto(route, { waitUntil: 'networkidle' });

    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });

  test(`${route} keeps navigation and content reachable on mobile`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-specific layout assertion');
    const diagnostics = installBrowserDiagnostics(page);
    await stubOpportunisticSync(page);
    await page.goto(route, { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: /navigation|nawigac/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('main#main-content')).toBeVisible();
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

test('notebook guest state offers sign-in instead of disabled workspace actions', async ({
  page,
}, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await stubOpportunisticSync(page);
  await page.goto('/notebook', { waitUntil: 'networkidle' });

  const signInLink = page.locator('a[href="/login"]').first();
  if (await signInLink.isVisible()) {
    await expect(signInLink).toBeEnabled();
    await expect(page.getByRole('button', { name: /load demo portfolio/i })).toHaveCount(0);
  }

  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('same-family comparison keeps per-side cash policies in the committed receipt', async ({
  page,
}, testInfo) => {
  test.skip(
    !['chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Chromium comparison receipt assertion',
  );
  if (testInfo.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 320, height: 700 });
  }
  const diagnostics = installBrowserDiagnostics(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
  const sharedConfig = {
    ...buildDefaultSharedConfig(new Date('2026-09-01T12:00:00Z')),
    purchaseDate: '2026-09-01',
    withdrawalDate: '2028-09-01',
    investmentHorizonMonths: 24,
    strategyPolicy: 'reinvest_until_horizon' as const,
  };
  const url = withComparisonUrlState('/compare', new URLSearchParams(), {
    sharedConfig,
    scenarioA: {
      bondType: BondType.ROR,
      strategyPolicy: 'cash_after_maturity',
      couponDisposition: 'cash',
    },
    scenarioB: {
      bondType: BondType.ROR,
      strategyPolicy: 'reinvest_until_horizon',
      couponDisposition: 'reinvest',
    },
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: /^calculate$/i })
    .first()
    .click();
  const receipt = page.getByRole('region', { name: 'Scenario plan' });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('Hold proceeds as cash after maturity');
  await expect(receipt).toContainText('Hold paid coupons as cash');
  if (testInfo.project.name === 'mobile-chromium') {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});
