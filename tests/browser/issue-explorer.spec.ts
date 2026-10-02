import { expect, test } from '@playwright/test';

import { decodeScenarioFromUrl } from '@/shared/lib/scenario-codec';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubOpportunisticSync,
} from './browser-diagnostics';

test('stored issues remain filterable by keyboard and hand off their identity', async ({
  page,
}, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
  await page.route('**/api/calculate/bond-series*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            seriesCode: 'ROR1027',
            emissionMonth: '2026-09-01',
            sellStartDate: '2026-09-01',
            sellEndDate: '2026-09-30',
            maturityDate: '2027-09-01',
            firstYearRate: '5.00',
            baseMargin: '0.00',
            earlyWithdrawalFee: '0.50',
            redemptionFeeCap: 'first-interest-then-principal',
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            seriesCode: 'ROS1029',
            emissionMonth: '2023-10-01',
            sellStartDate: '2023-10-01',
            sellEndDate: '2023-10-31',
            maturityDate: '2029-10-01',
            firstYearRate: '6.00',
            baseMargin: '1.50',
            earlyWithdrawalFee: '2.00',
          },
        ],
      }),
    });
  });

  await page.goto('/education', { waitUntil: 'networkidle' });
  const explorer = page.getByRole('region', { name: 'Explore stored bond issues' });
  const visibleIssue = (code: string) =>
    explorer.locator('h4:visible, th[scope="row"]:visible').filter({ hasText: code });
  await expect(visibleIssue('ROR1027')).toBeVisible();
  await expect(
    explorer.getByText('Monthly interest payout').filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    explorer
      .getByText(/Source freshness not checked/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    explorer
      .getByText('First period: interest cap; later periods: full fee may reduce principal')
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(visibleIssue('ROS1029')).toBeVisible();
  await expect(visibleIssue('ROS1029')).toContainText('Historical');

  const eligibility = explorer.getByLabel('Eligibility');
  await eligibility.focus();
  await eligibility.press('End');
  await expect(eligibility).toHaveValue('family');
  await expect(visibleIssue('ROR1027')).toHaveCount(0);
  await expect(visibleIssue('ROS1029')).toBeVisible();

  const link = explorer.getByRole('link', { name: 'Calculate this issue' });
  await expect(link).toBeVisible();
  const compare = explorer.getByRole('link', { name: 'Compare this issue' });
  await expect(compare).toBeVisible();
  const compared = decodeScenarioFromUrl(
    new URL((await compare.getAttribute('href'))!, 'http://localhost').searchParams.get('scenario'),
  );
  expect(compared.ok).toBe(true);
  if (compared.ok && compared.scenario.kind === 'bond-comparison') {
    expect(compared.scenario.intent.scenarioA.selectedSeriesId).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(compared.scenario.intent.sharedConfig.withdrawalDate).toBe('2029-10-01');
  }
  const href = await link.getAttribute('href');
  expect(href).toContain('/single-calculator?scenario=');
  const selected = decodeScenarioFromUrl(
    new URL(href!, 'http://localhost').searchParams.get('scenario'),
  );
  expect(selected.ok).toBe(true);
  if (selected.ok && selected.scenario.kind === 'single-bond') {
    expect(selected.scenario.intent.withdrawalDate).toBe('2029-10-01');
  }
  await link.click();
  await expect(page).toHaveURL(/\/single-calculator\?scenario=/);
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});
