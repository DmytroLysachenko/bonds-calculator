import { describe, expect, it } from 'vitest';

import {
  formatLighthouseSummary,
  reportNamesFromManifest,
  summarizeLighthouseReports,
} from './lighthouse-summary';

describe('summarizeLighthouseReports', () => {
  it('formats an empty report set without masking the preceding Lighthouse failure', () => {
    expect(formatLighthouseSummary([])).toContain('# Lighthouse route summary');
  });

  it('groups runs by route and reports deterministic medians', () => {
    const summary = summarizeLighthouseReports([
      {
        finalUrl: 'http://127.0.0.1:3100/compare',
        categories: { performance: { score: 0.7 } },
        audits: {
          'largest-contentful-paint': { numericValue: 3000 },
          'cumulative-layout-shift': { numericValue: 0.02 },
        },
      },
      {
        requestedUrl: 'http://127.0.0.1:3100/compare',
        categories: { performance: { score: 0.9 } },
        audits: {
          'largest-contentful-paint': { numericValue: 2000 },
          'cumulative-layout-shift': { numericValue: 0.01 },
        },
      },
    ]);

    expect(summary).toEqual([
      {
        route: '/compare',
        runs: 2,
        performanceScore: { min: 0.7, median: 0.8, max: 0.9 },
        lcpMs: { min: 2000, median: 2500, max: 3000 },
        cls: { min: 0.01, median: 0.015, max: 0.02 },
      },
    ]);
    expect(formatLighthouseSummary(summary)).toContain('| /compare | 2 | 0.80 | 2500 | 0.015 |');
  });

  it('selects only reports from the current Lighthouse manifest', () => {
    expect(
      reportNamesFromManifest([
        { jsonPath: '/tmp/current/home.report.json' },
        { jsonPath: '/tmp/current/single.report.json' },
      ]),
    ).toEqual(['home.report.json', 'single.report.json']);
    expect(() => reportNamesFromManifest([{ jsonPath: '/tmp/old-report.json' }])).toThrow(
      'invalid report path',
    );
  });
});
