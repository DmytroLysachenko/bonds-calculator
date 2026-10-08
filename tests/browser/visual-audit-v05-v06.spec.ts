import { expect, test } from '@playwright/test';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';

import { stubOpportunisticSync } from './browser-diagnostics';

test('V05: offer source and verification stay adjacent to education rates', async ({ page }) => {
  await stubOpportunisticSync(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/education', { waitUntil: 'networkidle' });
  const bond = page.locator('#bond-EDO');
  await expect(bond).toBeVisible();
  await expect(bond.getByText(/Fallback reference data|Synced offer data/)).toBeVisible();
  await expect(bond.getByText(/Last offer check attempt/)).toBeVisible();
  await expect(bond).toContainText('2026-09-01');
  await expect(bond.getByRole('link', { name: 'View dated Ministry source ↗' })).toHaveAttribute(
    'href',
    'https://www.gov.pl/web/finanse/podaz-skarbowych-papierow-wartosciowych-we-wrzesniu-2026',
  );
  for (const bondType of Object.values(BondType)) {
    const card = page.locator(`#bond-${bondType}`);
    await expect(card).toContainText('Fallback reference data — not a confirmed current offer');
    await expect(card).toContainText('2026-09-01');
    await expect(card.getByRole('link', { name: 'View dated Ministry source ↗' })).toBeVisible();
  }
  await expect(bond.getByRole('link', { name: 'Check official offer ↗' })).toHaveAttribute(
    'href',
    'https://www.obligacjeskarbowe.pl/',
  );
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: 'Check official offer ↗' })).toBeVisible();
  await page.goto('/economic-data?series=cpi', { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: 'Check official source ↗' })).toBeVisible();
});

test('V05: an issued rate identifies its series and effective sale date', async ({ page }) => {
  await stubOpportunisticSync(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.route('**/api/bond-definitions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...BOND_DEFINITIONS,
          [BondType.EDO]: {
            ...BOND_DEFINITIONS[BondType.EDO],
            rateProvenance: { kind: 'issued-series', asOf: '2026-09-01', seriesCode: 'EDO0936' },
          },
        },
      }),
    }),
  );
  await page.goto('/education', { waitUntil: 'networkidle' });
  const card = page.locator('#bond-EDO');
  await expect(card).toContainText('Recorded issued-series terms');
  await expect(card).toContainText('2026-09-01');
  await expect(card).toContainText('EDO0936');
  await expect(card).not.toContainText('Displayed terms effective date: Unavailable');
});

test('V06: schedule edits explain inputs and show adjacent validation in Polish', async ({
  page,
}) => {
  await stubOpportunisticSync(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'pl', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/regular-investment', { waitUntil: 'networkidle' });
  await page.getByText('Edytuj dodatki i zobacz pełny harmonogram').click();
  const date = page.getByLabel('Data dopłaty');
  const amount = page.getByLabel('Kwota dopłaty (PLN)');
  await expect(date).toBeVisible();
  await expect(amount).toBeVisible();
  await expect(page.getByText(/polski zapis to DD.MM.RRRR/)).toBeVisible();
  await expect(page.getByText(/Pomija zaplanowaną wpłatę bazową/)).toBeVisible();
  await page.getByRole('button', { name: 'Dodaj dopłatę' }).click();
  await expect(page.getByText('Wybierz prawidłową datę.')).toBeVisible();
  await expect(page.getByText('Podaj kwotę większą od 0 PLN.')).toBeVisible();
  await date.fill('2026-11-05');
  await page.getByRole('button', { name: 'Pomiń bazę' }).click();
  await expect(page.getByText(/5 lis 2026/)).toBeVisible();
  await page.getByRole('button', { name: 'Zastąp bazę' }).click();
  await expect(page.getByText('Podaj kwotę co najmniej 0 PLN.')).toBeVisible();
  await amount.fill('200');
  await page.getByRole('button', { name: 'Zastąp bazę' }).click();
  await expect(page.getByText('Podaj kwotę co najmniej 0 PLN.')).toHaveCount(0);
  await expect(page.locator('table').first()).not.toContainText('2026-');
  await expect(page.locator('table').first()).toContainText('zł');
});
