import { expect, test } from '@playwright/test';

import {
  stubGuestPortfolioAccess,
  stubOpportunisticSync,
  stubWebVitals,
} from './browser-diagnostics';

test('persists theme and locale preferences through the browser shell', async ({
  page,
}, testInfo) => {
  await stubGuestPortfolioAccess(page);
  await stubOpportunisticSync(page);
  await stubWebVitals(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  const mobileNavigation = page.getByRole('button', {
    name: /open navigation|otwórz nawigacj/i,
  });
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation.click();
  }
  const settingsRegion =
    testInfo.project.name === 'mobile-chromium' ? page.getByRole('dialog') : page.locator('aside');
  await settingsRegion
    .locator('summary')
    .filter({ hasText: /settings|ustawienia/i })
    .click();
  const themeToggle = page.getByRole('button', { name: /dark mode|tryb ciemny/i }).first();
  await themeToggle.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('bonds-calculator-theme')))
    .toBe('dark');

  await page.getByRole('button', { name: 'English' }).first().click();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en');
  await expect
    .poll(() => page.evaluate(() => document.cookie.includes('app-language=en')))
    .toBe(true);
});
