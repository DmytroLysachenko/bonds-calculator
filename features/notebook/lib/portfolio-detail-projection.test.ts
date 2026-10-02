import { describe, expect, it } from 'vitest';

import { BondType } from '@/features/bond-core/types';

import { buildPortfolioDetailProjection } from './portfolio-detail-projection';

describe('buildPortfolioDetailProjection', () => {
  it('uses injected time to produce deterministic maturity and cash-flow projections', () => {
    const result = buildPortfolioDetailProjection({
      lots: [
        {
          id: 'lot-1',
          portfolioId: 'portfolio-1',
          bondType: BondType.OTS,
          bondTypeId: null,
          bondSeriesId: null,
          purchaseDate: '2026-01-01',
          bondQuantity: '10',
          isRebought: false,
          notes: null,
          createdAt: new Date(),
        },
      ],
      definitions: {
        [BondType.OTS]: { duration: 1 },
      } as never,
      now: new Date('2026-12-01T00:00:00.000Z'),
      maturityWindowDays: 90,
    });

    expect(result.totalValue).toBe(1000);
    expect(result.nextMaturity).not.toBeNull();
    expect(result.nextMaturity?.maturityDate.getFullYear()).toBe(2027);
    expect(result.nextMaturity?.maturityDate.getMonth()).toBe(0);
    expect(result.nextMaturity?.maturityDate.getDate()).toBe(1);
    expect(result.upcomingCashflow).toBe(1000);
  });
});
