import { expect, firefox, test } from '@playwright/test';

import { stubOpportunisticSync } from './browser-diagnostics';

test('V02, V11 and V12: audited controls remain legible at 200% Firefox browser scaling', async () => {
  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: { 'layout.css.devPixelsPerPx': '2.0' },
  });
  try {
    const context = await browser.newContext({ viewport: null, deviceScaleFactor: undefined });
    await context.addCookies([
      { name: 'app-language', value: 'pl', domain: '127.0.0.1', path: '/' },
    ]);
    const page = await context.newPage();
    await stubOpportunisticSync(page);

    const viewport = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      pixelRatio: devicePixelRatio,
    }));
    expect(viewport.width).toBe(683);
    expect(viewport.pixelRatio).toBe(2);

    for (const route of ['/single-calculator', '/regular-investment', '/compare']) {
      await page.goto(`http://127.0.0.1:3100${route}`, { waitUntil: 'networkidle' });
      const calculate = page
        .locator('main#main-content')
        .getByRole('button', { name: /^(Oblicz|Przelicz)$/i });
      await expect(calculate).toHaveCount(1);
      const focusTarget =
        route === '/compare'
          ? page.locator('#comparison-scenarios-setup [role="combobox"]').first()
          : page.locator('#bondType');
      await focusTarget.focus();
      await focusTarget.evaluate((element) =>
        element.scrollIntoView({ block: 'end', behavior: 'instant' as ScrollBehavior }),
      );
      const visibility = await focusTarget.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(centerX, centerY);
        return {
          inViewport: centerY >= 0 && centerY < innerHeight,
          uncovered: hit === element || element.contains(hit),
          noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
        };
      });
      expect(visibility, route).toEqual({
        inViewport: true,
        uncovered: true,
        noHorizontalOverflow: true,
      });
    }

    await page.getByRole('button', { name: /Otwórz nawigacj/ }).click();
    const label = page
      .getByRole('dialog')
      .locator('a[href="/regular-investment"] span')
      .filter({ hasText: 'Regularne inwestowanie' })
      .first();
    await expect(label).toBeVisible();
    expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );

    for (const theme of ['light', 'dark']) {
      await page.goto('http://127.0.0.1:3100/education', { waitUntil: 'networkidle' });
      await page.evaluate((value) => localStorage.setItem('bonds-calculator-theme', value), theme);
      await page.reload({ waitUntil: 'networkidle' });
      const card = page.locator('#bond-EDO');
      for (const selector of ['dl', 'div.border-warning\\/60']) {
        const element = card.locator(selector);
        expect(
          await element.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
        ).toBeGreaterThanOrEqual(16);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await context.close();
  } finally {
    await browser.close();
  }
});
