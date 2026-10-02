import { describe, expect, it } from 'vitest';

import { SimulationEventType } from '@/features/bond-core/types/simulation';

import { buildCashFlowRows, reconcileCashFlows } from './cash-flow-display';

describe('cash-flow display', () => {
  it('keeps payouts and tax deductions as separate inspectable rows', () => {
    expect(
      buildCashFlowRows([
        { type: SimulationEventType.PAYOUT, date: '2026-01-01', description: 'coupon', value: 1 },
        {
          type: SimulationEventType.TAX_SETTLEMENT,
          date: '2026-01-01',
          description: 'tax',
          value: 0.19,
        },
      ]).map((row) => row.netCash),
    ).toEqual([1, -0.19]);
  });
  it('exposes rather than hides a reconciliation difference', () =>
    expect(
      reconcileCashFlows({
        contributions: 100,
        totalProfit: 10,
        terminalWealth: 110,
        paidOutValue: 0,
      }).difference,
    ).toBe(0));
});
