import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubOpportunisticSync,
} from './browser-diagnostics';

const auditedRoutes = [
  { path: '/', name: 'home' },
  { path: '/single-calculator', name: 'single calculator' },
  { path: '/economic-data', name: 'economic data' },
  { path: '/retirement', name: 'retirement' },
  { path: '/compare', name: 'comparison' },
  { path: '/regular-investment', name: 'regular investment' },
  { path: '/ladder', name: 'ladder strategy' },
  { path: '/optimize', name: 'optimizer' },
  { path: '/multi-asset', name: 'multi-asset comparison' },
  { path: '/recovery-lab', name: 'recovery lab' },
  { path: '/education', name: 'education' },
];

const reflowRoutes = [
  { path: '/compare', name: 'comparison' },
  { path: '/regular-investment', name: 'regular investment' },
  { path: '/ladder', name: 'ladder strategy' },
  { path: '/economic-data', name: 'economic data' },
  { path: '/retirement', name: 'retirement' },
  { path: '/multi-asset', name: 'multi-asset comparison' },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

for (const [locale, label] of [
  ['pl', /^data zakupu:/i],
  ['en', /^purchase date:/i],
] as const) {
  test(`comparison purchase-date control has a visible-name-compatible ${locale} name`, async ({
    page,
  }) => {
    await page
      .context()
      .addCookies([{ name: 'app-language', value: locale, domain: '127.0.0.1', path: '/' }]);
    await stubOpportunisticSync(page);
    await page.goto('/compare', { waitUntil: 'networkidle' });

    const trigger = page.getByRole('button', { name: label }).first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleName(label);
    await expect(trigger).toContainText(/\d{4}/);
  });
}

for (const [locale, route] of [
  ['en', { path: '/economic-data', name: 'economic data' }],
] as const) {
  test(`${route.name} remains accessible in ${locale}`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);
    await page
      .context()
      .addCookies([{ name: 'app-language', value: locale, domain: '127.0.0.1', path: '/' }]);
    await stubOpportunisticSync(page);
    await page.goto(route.path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    await testInfo.attach(`axe-${locale}.json`, {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

test('serves the scoped runtime-style CSP required by charts and sheets', async ({ page }) => {
  const response = await page.goto('/economic-data', { waitUntil: 'domcontentloaded' });
  const policy = response?.headers()['content-security-policy'] ?? '';

  expect(policy).toContain("style-src-elem 'self' 'nonce-");
  expect(policy).toContain("style-src-attr 'unsafe-inline'");
  expect(policy).toMatch(/style-src 'self' 'nonce-[^']+';/);
  expect(policy).not.toMatch(/(?:^|;\s*)style-src\s[^;]*'unsafe-inline'/);
});

for (const route of auditedRoutes) {
  test(`${route.name} has no automated accessibility violations`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);
    await stubOpportunisticSync(page);
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await expect(page.locator('main#main-content')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    await testInfo.attach('axe-results.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

for (const route of [
  { path: '/compare', name: 'comparison' },
  { path: '/regular-investment', name: 'regular investment' },
  { path: '/ladder', name: 'ladder strategy' },
] as const) {
  test(`${route.name} exposes a keyboard-operable skip link`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);
    await stubOpportunisticSync(page);
    await page.goto(route.path, { waitUntil: 'networkidle' });

    await page.keyboard.press('Tab');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

for (const route of reflowRoutes) {
  test(`${route.name} keeps its main content reachable at 200% zoom`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium-only browser zoom control');
    const diagnostics = installBrowserDiagnostics(page);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await stubOpportunisticSync(page);
    await page.goto(route.path, { waitUntil: 'networkidle' });

    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();
    await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

for (const route of [
  { path: '/compare', name: 'comparison' },
  { path: '/regular-investment', name: 'regular investment' },
  { path: '/economic-data', name: 'economic data' },
] as const) {
  test(`${route.name} preserves an operable main landmark at 400% zoom`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium-only browser zoom control');
    const diagnostics = installBrowserDiagnostics(page);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
    await stubOpportunisticSync(page);
    await page.goto(route.path, { waitUntil: 'networkidle' });

    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();
    await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

for (const route of reflowRoutes) {
  test(`${route.name} reflows without horizontal page scrolling at a 320px viewport`, async ({
    page,
  }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await stubOpportunisticSync(page);
    await page.goto(route.path, { waitUntil: 'networkidle' });

    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}

test('mobile navigation control meets the 44px comfortable target and returns focus after closing', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-specific interaction assertion');
  const diagnostics = installBrowserDiagnostics(page);
  await stubOpportunisticSync(page);
  await page.goto('/compare', { waitUntil: 'networkidle' });

  const navigationButton = page.getByRole('button', { name: /navigation|nawigac/i });
  const targetBox = await navigationButton.boundingBox();
  expect(targetBox?.width).toBeGreaterThanOrEqual(44);
  expect(targetBox?.height).toBeGreaterThanOrEqual(44);

  await navigationButton.focus();
  await navigationButton.press('Enter');
  const navigation = page.locator('nav[aria-label]:visible');
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigationButton).toBeFocused();
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('reduced-motion preference keeps core navigation usable', async ({ page }, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubOpportunisticSync(page);
  await page.goto('/single-calculator', { waitUntil: 'networkidle' });

  await expect(page.locator('main#main-content')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('a[href="#main-content"]')).toBeFocused();
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('single-calculator submission moves focus to blocking input feedback', async ({
  page,
}, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await stubOpportunisticSync(page);
  await page.goto('/single-calculator', { waitUntil: 'networkidle' });

  const investment = page.locator('input[name="bondUnits"]');
  await investment.fill('0');
  await investment.press('Enter');

  const summary = page.locator('[role="alert"]').filter({ hasText: /minimum purchase/i });
  await expect(summary).toBeFocused();
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('single-calculator success keeps keyboard focus out of the page body', async ({
  page,
}, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
  await page.goto('/single-calculator', { waitUntil: 'networkidle' });

  const calculate = page.getByRole('button', { name: /^calculate$/i }).last();
  await calculate.focus();
  await calculate.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit plan', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toBeFocused();
  await expect(page.locator('#calculator-results')).toBeFocused();

  const edit = page.getByRole('button', { name: 'Edit plan', exact: true });
  await edit.press('Enter');
  await expect(page.locator('#calculator-inputs :focus')).toHaveCount(1);
  const close = page.getByRole('button', { name: 'Close plan' });
  await close.press('Enter');
  await expect(edit).toBeFocused();
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('comparison keyboard plan controls never trigger an accidental calculation', async ({
  page,
}, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
  await page.goto('/compare', { waitUntil: 'networkidle' });

  const modeControl = page.locator('[data-comparison-plan] button').first();
  await modeControl.focus();
  await modeControl.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit plan' })).toHaveCount(0);
  const calculate = page.getByRole('button', { name: /^calculate$/i }).first();
  await expect(calculate).toBeVisible();
  await calculate.press('Enter');
  const edit = page.getByRole('button', { name: 'Edit plan', exact: true });
  await expect(edit).toBeVisible();
  await expect(page.locator('body')).not.toBeFocused();
  await edit.press('Enter');
  await expect(page.locator('[data-comparison-plan] :focus')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close plan' }).press('Enter');
  await expect(edit).toBeFocused();
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('comparison mobile receipt edits a named section and returns to results', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only result navigation');
  const diagnostics = installBrowserDiagnostics(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
  await page.goto('/compare', { waitUntil: 'networkidle' });

  await page
    .getByRole('button', { name: /^calculate$/i })
    .first()
    .click();
  const receipt = page.getByRole('region', { name: 'Scenario plan' });
  await expect(receipt.getByRole('button', { name: 'Edit plan: Bond Quantity' })).toBeVisible();
  await receipt.getByRole('button', { name: 'Edit plan: Bond Quantity' }).click();
  await expect(page.locator('#comparison-shared-setup :focus')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close plan' }).click();
  await expect(receipt.getByRole('link', { name: 'Jump to results' })).toBeVisible();
  await receipt.getByRole('link', { name: 'Jump to results' }).click();
  await expect(page).toHaveURL(/#comparison-results$/);
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

test('regular family change requires a visible horizon choice', async ({ page }, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  await page
    .context()
    .addCookies([{ name: 'app-language', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await stubOpportunisticSync(page);
  await page.goto('/regular-investment', { waitUntil: 'networkidle' });

  await page.locator('#bondType').click();
  await page.getByRole('option', { name: /ROR/ }).click();
  await expect(page.getByRole('group', { name: 'Choose the horizon for ROR' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep current horizon' })).toBeFocused();
  await page.getByRole('button', { name: 'Use native maturity (12 months)' }).click();
  await expect(page.locator('#bondType')).toContainText('ROR');
  await expectNoBrowserDiagnostics(testInfo, diagnostics);
});

for (const scenario of [
  {
    locale: 'en',
    bond: 'EDO',
    section: /inflation setup/i,
    advanced: 'Advanced',
    field: 'Advanced yearly CPI path, Y1',
  },
  {
    locale: 'pl',
    bond: 'ROR',
    section: /ustawienia stopy NBP/i,
    advanced: 'Zaawansowane',
    field: 'Zaawansowana roczna ścieżka NBP, Y1',
  },
] as const) {
  test(`${scenario.locale} expanded ${scenario.bond} path keeps labelled keyboard fields`, async ({
    page,
  }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);
    await page
      .context()
      .addCookies([
        { name: 'app-language', value: scenario.locale, domain: '127.0.0.1', path: '/' },
      ]);
    await stubOpportunisticSync(page);
    await page.goto(`/single-calculator?bond=${scenario.bond}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: scenario.section }).click();
    await page.getByRole('button', { name: scenario.advanced, exact: true }).click();
    const field = page.getByRole('spinbutton', { name: scenario.field, exact: true });
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute('aria-describedby', /.+/);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}
