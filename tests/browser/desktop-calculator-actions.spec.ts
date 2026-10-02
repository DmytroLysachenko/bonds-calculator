import { expect, test } from '@playwright/test';

import { createSavedScenario } from '@/features/single-calculator/lib/scenario-storage';
import { buildFallbackInputs } from '@/features/single-calculator/lib/single-calculator-state';

import { stubOpportunisticSync } from './browser-diagnostics';

test('V01: twelve saved scenarios do not bury the first calculator field', async ({ page }) => {
  test.setTimeout(60_000);
  await stubOpportunisticSync(page);
  const inputs = buildFallbackInputs(new Date('2026-09-29T12:00:00Z'));
  const records = Array.from({ length: 12 }, (_, index) => ({
    ...createSavedScenario(inputs, { name: 'My scenario' }),
    id: `scenario-${index + 1}`,
    updatedAt: '2026-09-29T12:00:00.000Z',
  }));
  await page.addInitScript((savedRecords) => {
    window.localStorage.setItem(
      'obligacje.saved-single-scenarios.v1',
      JSON.stringify(savedRecords),
    );
  }, records);

  for (const viewport of [
    { width: 1903, height: 900 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/single-calculator', { waitUntil: 'networkidle' });

    const firstField = page.locator('#bondType');
    await expect(firstField).toBeVisible();
    const fieldBox = await firstField.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.y).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );

    const library = page.getByRole('region', { name: /saved scenarios|zapisane scenariusze/i });
    await expect(library.getByRole('button', { name: /restore|przywróć/i })).toHaveCount(2);
    await expect(library).toContainText('#1');
    await expect(library).toContainText('#2');

    const shortcut = page.locator('a[href="#saved-scenarios-title"]');
    await shortcut.click();
    await expect(page).toHaveURL(/#saved-scenarios-title$/);
    await expect(page.locator('#saved-scenarios-title')).toBeFocused();

    const toggle = library.locator('button[aria-controls="saved-scenario-library-content"]');
    await toggle.focus();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(library.getByRole('button', { name: /restore|przywróć/i })).toHaveCount(12);
    await expect(library.getByRole('textbox', { name: /search|szukaj/i })).toBeVisible();
  }
});

test('V02: each audited desktop calculator has one in-flow action without an overlay', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await stubOpportunisticSync(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);

  for (const viewport of [
    { width: 1903, height: 900 },
    { width: 1366, height: 768 },
    { width: 683, height: 768 }, // 1366px desktop at 200% effective CSS zoom.
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['/single-calculator', '/regular-investment', '/compare']) {
      await page.goto(route, { waitUntil: 'networkidle' });
      const docks = page.locator('.ui-action-dock');
      await expect(docks).toHaveCount(1);
      if (route === '/compare') {
        await expect(docks).toBeHidden();
      } else {
        await expect(docks.locator('..')).toHaveCSS('position', 'static');
      }
      await expect(
        page
          .locator('main#main-content')
          .getByRole('button', { name: /^(Calculate|Recalculate)$/i }),
      ).toHaveCount(1);
      const focusTarget =
        route === '/compare'
          ? page.locator('#comparison-scenarios-setup [role="combobox"]').first()
          : page.locator('#bondType');
      await focusTarget.focus();
      await expect(focusTarget).toBeFocused();
      await focusTarget.evaluate((element) => {
        element.scrollIntoView({ block: 'end', behavior: 'instant' as ScrollBehavior });
      });
      const inspectFocusHit = () =>
        focusTarget.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const pointX = rect.left + rect.width / 2;
          const pointY = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(pointX, pointY);
          return {
            uncovered: hit === element || element.contains(hit),
            hit: hit?.outerHTML.slice(0, 200),
            pointX,
            pointY,
          };
        });
      await expect.poll(async () => (await inspectFocusHit()).pointY).toBeLessThan(viewport.height);
      const focusHit = await inspectFocusHit();
      expect(focusHit.uncovered, `${route} ${viewport.width}px: ${JSON.stringify(focusHit)}`).toBe(
        true,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
    }
  }
});

test('V02: the compact mobile action remains available without horizontal overflow', async ({
  page,
}) => {
  await stubOpportunisticSync(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);

  for (const route of ['/single-calculator', '/regular-investment', '/compare']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    const dock = page.locator('.ui-action-dock');
    await expect(dock).toBeVisible();
    await expect(dock.locator('..')).toHaveCSS('position', 'fixed');
    await expect(dock.getByRole('button', { name: 'Calculate' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  }
});
