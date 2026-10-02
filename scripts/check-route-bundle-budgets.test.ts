import { describe, expect, it } from 'vitest';

import { findBundleBudgetFailures } from './check-route-bundle-budgets';

describe('findBundleBudgetFailures', () => {
  const budgets = [
    { route: '/compare', maxBytes: 100 },
    { route: '/ladder', maxBytes: 200 },
  ] as const;

  it('accepts routes within their configured limits', () => {
    expect(
      findBundleBudgetFailures(
        [
          { route: '/compare', bytes: 100 },
          { route: '/ladder', bytes: 199 },
        ],
        budgets,
      ),
    ).toEqual([]);
  });

  it('reports missing and oversized routes clearly', () => {
    expect(findBundleBudgetFailures([{ route: '/compare', bytes: 101 }], budgets)).toEqual([
      '/compare: 101 bytes exceeds 100 bytes',
      '/ladder: route missing from bundle report',
    ]);
  });
});
