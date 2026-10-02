import { describe, expect, it } from 'vitest';

import { createSweepValues, findZeroCrossings, SensitivityRequestSchema } from './single-bond';

describe('single-bond sensitivity bounds', () => {
  it('creates inclusive bounded point values without floating-point drift', () => {
    expect(createSweepValues(1, 2, 0.25)).toEqual([1, 1.25, 1.5, 1.75, 2]);
  });

  it('rejects a workload greater than thirteen points', () => {
    const parsed = SensitivityRequestSchema.safeParse({
      inputs: {
        bondType: 'COI',
        initialInvestment: 100,
        expectedInflation: 3,
        purchaseDate: '2026-01-01',
        withdrawalDate: '2027-01-01',
        isRebought: false,
        taxStrategy: 'STANDARD',
        customInflation: [],
        customNbpRate: [],
      },
      variable: 'inflation',
      start: 0,
      end: 14,
      step: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it('reports every profit sign-change bracket instead of assuming one root', () => {
    expect(
      findZeroCrossings([
        { value: 1, totalProfit: -2 },
        { value: 2, totalProfit: 3 },
        { value: 3, totalProfit: -1 },
        { value: 4, totalProfit: 2 },
      ]),
    ).toEqual([
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ]);
  });

  it('does not invent a crossing around failed points', () => {
    expect(
      findZeroCrossings([
        { value: 1, totalProfit: -2 },
        { value: 2, error: 'threshold failure' },
        { value: 3, totalProfit: 2 },
      ]),
    ).toEqual([]);
  });
});
