import { describe, expect, it } from 'vitest';

import { findLighthouseRouteBudgetFailures } from './check-lighthouse-route-budgets';
import type { LighthouseRouteSummary } from './lighthouse-summary';

const measured: LighthouseRouteSummary = {
  route: '/single-calculator',
  runs: 3,
  performanceScore: { min: 0.61, median: 0.69, max: 0.72 },
  lcpMs: { min: 3600, median: 3671, max: 3809 },
  cls: { min: 0, median: 0.018, max: 0.021 },
};

describe('Lighthouse route budgets', () => {
  it('accepts a three-run median below its route ceiling', () => {
    expect(
      findLighthouseRouteBudgetFailures(
        [measured],
        [{ route: '/single-calculator', maxMedianLcpMs: 4600 }],
      ),
    ).toEqual([]);
  });

  it('fails on the median rather than allowing one lucky fast run', () => {
    expect(
      findLighthouseRouteBudgetFailures(
        [{ ...measured, lcpMs: { min: 2200, median: 4900, max: 5300 } }],
        [{ route: '/single-calculator', maxMedianLcpMs: 4600 }],
      ),
    ).toEqual(['/single-calculator: median LCP 4900ms exceeds 4600ms']);
  });

  it('rejects missing or incomplete route evidence', () => {
    const budget = [{ route: '/single-calculator', maxMedianLcpMs: 4600 }];
    expect(findLighthouseRouteBudgetFailures([], budget)).toContain(
      '/single-calculator: no Lighthouse reports in current manifest',
    );
    expect(findLighthouseRouteBudgetFailures([{ ...measured, runs: 2 }], budget)).toContain(
      '/single-calculator: expected three scored runs with LCP, got 2',
    );
  });
});
