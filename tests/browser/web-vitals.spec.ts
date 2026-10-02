import { expect, test } from '@playwright/test';

import {
  expectNoBrowserDiagnostics,
  installBrowserDiagnostics,
  stubOpportunisticSync,
  stubWebVitals,
} from './browser-diagnostics';

const budgetedRoutes = [
  { path: '/', name: 'home' },
  { path: '/single-calculator', name: 'single calculator' },
];

const attributedRoutes = [
  ...budgetedRoutes,
  { path: '/economic-data', name: 'economic data' },
  { path: '/compare', name: 'comparison' },
  { path: '/regular-investment', name: 'regular investment' },
];

type LcpAttribution = {
  element: string | null;
  navigationResponseMs: number;
  resourceCount: number;
  scriptTransferBytes: number;
  totalLongTaskMs: number;
};

type BrowserMetrics = {
  domContentLoadedMs: number;
  loadEventMs: number;
  lcpMs: number | null;
  scriptCount: number;
  scriptTransferBytes: number;
  lcpAttribution: LcpAttribution | null;
};

function collectPerformanceEntries(): BrowserMetrics {
  const navigation = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const scripts = resources.filter((resource) => resource.initiatorType === 'script');
  const lcp = (window as typeof window & { __largestContentfulPaint?: number })
    .__largestContentfulPaint;
  const lcpAttribution = (window as typeof window & { __lcpAttribution?: LcpAttribution })
    .__lcpAttribution;

  return {
    domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
    loadEventMs: navigation?.loadEventEnd ?? 0,
    lcpMs: lcp ?? null,
    scriptCount: scripts.length,
    scriptTransferBytes: scripts.reduce((sum, script) => sum + (script.transferSize || 0), 0),
    lcpAttribution: lcpAttribution ?? null,
  };
}

function installLcpAttributionObserver() {
  const state = window as typeof window & {
    __largestContentfulPaint?: number;
    __lcpAttribution?: LcpAttribution;
  };
  let totalLongTaskMs = 0;

  new PerformanceObserver((entries) => {
    totalLongTaskMs += entries.getEntries().reduce((total, entry) => total + entry.duration, 0);
  }).observe({ type: 'longtask', buffered: true });

  new PerformanceObserver((entries) => {
    const entry = entries.getEntries().at(-1) as PerformanceEntry & { element?: Element };
    if (!entry) return;

    const navigation = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const scripts = resources.filter((resource) => resource.initiatorType === 'script');
    const element = entry.element;

    state.__largestContentfulPaint = entry.startTime;
    state.__lcpAttribution = {
      element: element
        ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className && typeof element.className === 'string' ? `.${element.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')}` : ''}`
        : null,
      navigationResponseMs: navigation?.responseStart ?? 0,
      resourceCount: resources.length,
      scriptTransferBytes: scripts.reduce((total, script) => total + (script.transferSize || 0), 0),
      totalLongTaskMs,
    };
  }).observe({ type: 'largest-contentful-paint', buffered: true });
}

for (const route of budgetedRoutes) {
  test(`${route.name} stays within baseline browser budgets`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);

    await stubOpportunisticSync(page);
    await stubWebVitals(page);
    await page.addInitScript(installLcpAttributionObserver);
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await expect(page.locator('main#main-content')).toBeVisible();

    const metrics = await page.evaluate(collectPerformanceEntries);

    console.info(`${route.name} browser budget metrics`, metrics);

    await expectNoBrowserDiagnostics(testInfo, diagnostics);
    expect(metrics.domContentLoadedMs).toBeGreaterThan(0);
    expect(metrics.domContentLoadedMs).toBeLessThan(4_000);
    expect(metrics.loadEventMs).toBeLessThan(6_000);
    expect(metrics.scriptCount).toBeLessThan(80);
    expect(metrics.scriptTransferBytes).toBeLessThan(1_500_000);

    expect(metrics.lcpMs).not.toBeNull();
    expect(metrics.lcpMs).toBeLessThan(2_500);
  });
}

for (const route of attributedRoutes) {
  test(`${route.name} records LCP attribution for Lighthouse triage`, async ({
    page,
  }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);

    await stubOpportunisticSync(page);
    await stubWebVitals(page);
    await page.addInitScript(installLcpAttributionObserver);
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await expect(page.locator('main#main-content')).toBeVisible();

    const metrics = await page.evaluate(collectPerformanceEntries);
    await testInfo.attach('lcp-attribution.json', {
      body: JSON.stringify({ route: route.path, metrics }, null, 2),
      contentType: 'application/json',
    });

    await expectNoBrowserDiagnostics(testInfo, diagnostics);
    expect(metrics.lcpMs).not.toBeNull();
    expect(metrics.lcpAttribution).not.toBeNull();
  });
}

for (const route of [
  { path: '/single-calculator', name: 'single calculator' },
  { path: '/regular-investment', name: 'regular investment' },
]) {
  test(`${route.name} loads advanced assumptions when expanded`, async ({ page }, testInfo) => {
    const diagnostics = installBrowserDiagnostics(page);

    await stubOpportunisticSync(page);
    await stubWebVitals(page);
    await page.goto(route.path, { waitUntil: 'networkidle' });

    const advancedTrigger = page
      .locator('main#main-content [data-slot="accordion-trigger"]')
      .first();
    await advancedTrigger.click();
    await expect(page.getByTestId('market-assumptions-form')).toBeVisible();

    await expectNoBrowserDiagnostics(testInfo, diagnostics);
  });
}
