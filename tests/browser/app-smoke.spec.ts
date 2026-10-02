import { expect, test } from '@playwright/test';

import { ScenarioKind } from '@/features/bond-core/types/scenarios';
import { getCalculationEndpoint } from '@/shared/lib/calculation-endpoints';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubGuestPortfolioAccess,
  stubOpportunisticSync,
  stubWebVitals,
} from './browser-diagnostics';

const smokeRoutes = [
  { path: '/', name: 'home' },
  { path: '/education', name: 'education' },
  { path: '/single-calculator', name: 'single calculator' },
  { path: '/compare', name: 'comparison' },
  { path: '/regular-investment', name: 'regular investment' },
  { path: '/ladder', name: 'ladder strategy' },
  { path: '/notebook', name: 'portfolio notebook' },
  { path: '/economic-data', name: 'economic data' },
];

function defineSmokeTest(route: (typeof smokeRoutes)[number]) {
  test(`${route.name} renders without runtime errors`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);

    await stubOpportunisticSync(page);
    await stubGuestPortfolioAccess(page);
    await stubWebVitals(page);
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('nav[aria-label]').first()).toBeAttached();
    await expect(page.locator('a[href="#main-content"]').first()).toBeAttached();

    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

for (const route of smokeRoutes.filter((route) => route.path !== '/notebook')) {
  defineSmokeTest(route);
}

for (const { path, setupSelector } of [
  { path: '/education', setupSelector: '#choose-a-path' },
  { path: '/single-calculator', setupSelector: 'form#single-calculator-inputs' },
  { path: '/compare', setupSelector: '#comparison-shared-setup' },
  { path: '/regular-investment', setupSelector: '#regular-instrument-setup' },
]) {
  test(`${path} paints setup before client offer revalidation`, async ({ page }) => {
    let releaseDefinitionRequest: () => void = () => undefined;
    const definitionRequestGate = new Promise<void>((resolve) => {
      releaseDefinitionRequest = resolve;
    });
    await page.route('**/api/bond-definitions', async (route) => {
      await definitionRequestGate;
      await route.continue();
    });

    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(setupSelector)).toBeVisible();
    } finally {
      releaseDefinitionRequest();
    }
  });
}

test('shared content canvas aligns routes and prevents horizontal overflow', async ({ page }) => {
  await stubOpportunisticSync(page);
  await stubGuestPortfolioAccess(page);
  await stubWebVitals(page);

  const routes = ['/', '/single-calculator', '/compare', '/economic-data'];
  const canvasBoxes: { x: number; width: number }[] = [];

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });

    const canvas = page.locator('.ui-app-canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    canvasBoxes.push({ x: box!.x, width: box!.width });

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  }

  const firstCanvas = canvasBoxes[0];
  for (const canvas of canvasBoxes.slice(1)) {
    expect(canvas.x).toBeCloseTo(firstCanvas.x, 0);
    expect(canvas.width).toBeCloseTo(firstCanvas.width, 0);
  }
});

test('trusted-core routes: accessible education, calculator, and economic journeys', async ({
  page,
}, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await stubOpportunisticSync(page);
  await stubGuestPortfolioAccess(page);
  await stubWebVitals(page);

  for (const route of ['/education', '/single-calculator', '/economic-data']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('a[href="#main-content"]')).toBeAttached();
    await expect(page.locator('body')).not.toContainText('Application error');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  }

  await page.goto('/education', { waitUntil: 'domcontentloaded' });
  await expect(
    page
      .locator('#current-offers')
      .getByRole('link', { name: /official|oficjal/i })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /calculate|oblicz|policz/i }).first()).toBeVisible();

  await page.goto('/single-calculator', { waitUntil: 'domcontentloaded' });
  const calculateButton = page.getByRole('button', { name: /calculate|oblicz/i }).first();
  await calculateButton.focus();
  await expect(calculateButton).toBeFocused();
  const calculationResponse = page.waitForResponse(
    (response) =>
      response.url().includes(getCalculationEndpoint(ScenarioKind.SINGLE_BOND)) && response.ok(),
  );
  await calculateButton.click();
  await calculationResponse;
  await expect(page.locator('#calculator-results')).toBeVisible();

  await page.goto('/economic-data', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /CPI/i }).press('Tab');
  await expect(page.getByRole('button', { name: 'NBP' })).toBeFocused();
  await page.getByRole('button', { name: 'NBP' }).press('Enter');
  await expect(page.getByRole('button', { name: 'NBP' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/series=nbp/);
  await page.goBack();
  await expect(page.getByRole('button', { name: /CPI/i })).toHaveAttribute('aria-pressed', 'true');
  await page.getByText(/coverage and freshness|pokrycie i świeżość/i).click();
  await expect(page.getByText(/source|źródło/i).first()).toBeVisible();

  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test.describe('portfolio notebook', () => {
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });
  defineSmokeTest({ path: '/notebook', name: 'portfolio notebook' });
});
