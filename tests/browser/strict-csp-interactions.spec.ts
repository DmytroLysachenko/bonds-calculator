import { expect, test } from '@playwright/test';

import {
  stubGuestPortfolioAccess,
  stubOpportunisticSync,
  stubWebVitals,
} from './browser-diagnostics';

async function prepareStrictPage(page: Parameters<typeof stubOpportunisticSync>[0]) {
  await stubOpportunisticSync(page);
  await stubGuestPortfolioAccess(page);
  await stubWebVitals(page);
  await page.addInitScript(() => {
    (window as typeof window & { __cspViolations?: string[] }).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as typeof window & { __cspViolations?: string[] }).__cspViolations?.push(
        `${event.effectiveDirective}: ${event.blockedURI} @ ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });
}

test('populated calculator works with production-style CSP enforced', async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.endsWith('-csp'),
    'This scenario verifies enforced CSP projects.',
  );
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00.000Z'));
  await prepareStrictPage(page);
  const response = await page.goto('/single-calculator', { waitUntil: 'domcontentloaded' });
  expect(response?.headers()['content-security-policy']).toContain(
    "style-src-attr 'unsafe-inline'",
  );
  await page.waitForLoadState('networkidle');
  await page.locator('button[form="single-calculator-inputs"]').click();
  await expect(page.getByText(/results current|wyniki aktualne/i)).toBeVisible();
  await page
    .getByRole('region', { name: /bond value chart|wykres wartości obligacji/i })
    .scrollIntoViewIfNeeded();
  const chart = page.locator('.recharts-surface').first();
  await expect(chart).toBeVisible();
  if (testInfo.project.name === 'chromium-csp') {
    await expect(chart).toHaveScreenshot('single-chart-csp.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  }
  await chart.hover({ position: { x: 100, y: 100 } });
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(chart).toBeVisible();
  await expect(page.getByRole('button', { name: /^(edit plan|edytuj plan)$/i })).toBeVisible();
  await page.getByRole('button', { name: /^(edit plan|edytuj plan)$/i }).click();
  await page
    .getByRole('button', { name: /more information|więcej informacji/i })
    .first()
    .hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.getByRole('button', { name: /^(purchase date|data zakupu)$/i }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByText(/settings|ustawienia/i)
    .first()
    .click();
  await page
    .getByRole('button', { name: /dark mode|tryb ciemny/i })
    .first()
    .click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'English' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const violations = await page.evaluate(
    () => (window as typeof window & { __cspViolations?: string[] }).__cspViolations ?? [],
  );
  expect(violations).toEqual([]);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__untrustedInlineRan = true';
    document.body.appendChild(script);
  });
  expect(
    await page.evaluate(() =>
      Boolean((window as typeof window & { __untrustedInlineRan?: boolean }).__untrustedInlineRan),
    ),
  ).toBe(false);
});

test('populated comparison works with strict CSP on a narrow viewport', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(
    !testInfo.project.name.endsWith('-csp'),
    'This scenario verifies enforced CSP projects.',
  );
  await page.setViewportSize({ width: 320, height: 700 });
  await prepareStrictPage(page);
  const response = await page.goto('/compare', { waitUntil: 'domcontentloaded' });
  expect(response?.headers()['content-security-policy']).toContain(
    "style-src-attr 'unsafe-inline'",
  );
  await page.waitForLoadState('networkidle');
  await page
    .getByRole('button', { name: /^(calculate|oblicz)$/i })
    .first()
    .click();
  await expect(page.getByText(/comparison snapshot|migawka porównania/i)).toBeVisible({
    timeout: 30_000,
  });
  const navigation = page.getByRole('button', { name: /open navigation|otwórz nawigacje/i });
  await navigation.click();
  const dialog = page.getByRole('dialog', { name: /navigation menu|menu nawigacji/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(navigation).toBeFocused();
  const violations = await page.evaluate(
    () => (window as typeof window & { __cspViolations?: string[] }).__cspViolations ?? [],
  );
  expect(violations).toEqual([]);
});
