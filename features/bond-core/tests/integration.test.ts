import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';

import {
  BondType,
  CalculationResult,
  InterestPayout,
  TaxStrategy,
  YearlyTimelinePoint,
} from '../types';
import { ScenarioKind } from '../types/scenarios';

// Mock data-access to simulate DB interaction
vi.mock('@/lib/data/market-data', () => ({
  getTaxRulesForYear: vi.fn().mockResolvedValue(null),
  getHistoricalDataMap: vi.fn().mockResolvedValue({
    '2023-01': { inflation: 17.2, nbpRate: 6.75 },
    '2023-02': { inflation: 18.4, nbpRate: 6.75 },
    '2023-03': { inflation: 16.1, nbpRate: 6.75 },
  }),
  getBondDefinitions: vi.fn().mockResolvedValue([]),
  getBondDefinitionsMap: vi.fn().mockResolvedValue({}),
  getGlobalDataFreshness: vi.fn().mockResolvedValue({ status: 'fresh', usedFallback: false }),
  getTaxRulesRevision: vi.fn().mockResolvedValue('tax-rules-2026'),
  getHistoricalAverages: vi.fn().mockResolvedValue({
    inflation: { '1y': 5.0, '5y': 4.0, '10y': 3.5 },
    nbpRate: { '1y': 6.75, '5y': 4.5, '10y': 3.5 },
  }),
}));

describe('Bond Core Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePayload = {
    bondType: BondType.EDO,
    initialInvestment: 10000,
    firstYearRate: 7.25,
    expectedInflation: 3.0,
    expectedNbpRate: 5.75,
    margin: 2.0,
    duration: 10,
    earlyWithdrawalFee: 2.0,
    taxRate: 19,
    isCapitalized: true,
    payoutFrequency: InterestPayout.MATURITY,
    purchaseDate: '2024-01-01',
    withdrawalDate: '2034-01-01',
    isRebought: false,
    rebuyDiscount: 0.0,
    taxStrategy: TaxStrategy.STANDARD,
  };

  it('should correctly apply STANDARD tax strategy (19% Belka tax)', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.SINGLE_BOND,
      payload: { ...basePayload, taxStrategy: TaxStrategy.STANDARD },
    });

    const result = envelope.result as CalculationResult;
    expect(result.totalTax).toBeGreaterThan(0);
    // Gross profit = result.grossValue - result.initialInvestment
    const grossProfit = result.grossValue - result.initialInvestment;
    const expectedTax = grossProfit * 0.19;
    expect(result.totalTax).toBeCloseTo(expectedTax, 0);
  });

  it('should correctly apply IKE tax strategy (0% tax)', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.SINGLE_BOND,
      payload: { ...basePayload, taxStrategy: TaxStrategy.IKE },
    });

    const result = envelope.result as CalculationResult;
    expect(result.totalTax).toBe(0);
    expect(result.netPayoutValue).toBe(result.grossValue);
  });

  it('should correctly apply IKZE tax strategy (10% lump sum tax)', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.SINGLE_BOND,
      payload: { ...basePayload, taxStrategy: TaxStrategy.IKZE },
    });

    const result = envelope.result as CalculationResult;
    // IKZE in this app applies 10% tax on the TOTAL payout (principal + interest)
    expect(result.totalTax).toBeGreaterThan(0);
    const expectedTax = result.grossValue * 0.1;
    expect(result.totalTax).toBeCloseTo(expectedTax, 0);
  });

  it('should handle inflation-indexed bonds (COI) correctly', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.SINGLE_BOND,
      payload: {
        ...basePayload,
        bondType: BondType.COI,
        duration: 4,
        withdrawalDate: '2028-01-01',
        isCapitalized: false,
        payoutFrequency: InterestPayout.YEARLY,
      },
    });

    const result = envelope.result as CalculationResult;
    expect(result.timeline.length).toBeGreaterThan(1);
    // COI is 4 years, should have 4 yearly points + initial
    expect(result.timeline.filter((p: YearlyTimelinePoint) => p.year > 0).length).toBe(4);
  });
});
