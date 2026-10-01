import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';

import { BondType, TaxStrategy } from '../types';
import { PortfolioSimulationResult, ScenarioKind } from '../types/scenarios';
import { calculationCache } from '../utils/calculation-cache';

vi.mock('@/lib/data/market-data', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');
  const historicalMap: Record<string, { inflation?: number; nbpRate?: number }> = {};
  const start = new Date('2024-01-01T00:00:00.000Z');

  for (let offset = 0; offset <= 180; offset += 1) {
    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() + offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    historicalMap[key] = {
      inflation: 3,
      nbpRate: 5,
    };
  }

  return {
    getHistoricalDataMap: vi.fn().mockResolvedValue(historicalMap),
    getBondDefinitions: vi.fn().mockResolvedValue(Object.values(runtimeDefinitions)),
    getBondDefinitionsMap: vi.fn().mockResolvedValue(runtimeDefinitions),
    getGlobalDataFreshness: vi.fn().mockResolvedValue({
      status: 'fresh',
      asOf: '2026-05',
      lastCheck: '2026-05-30T00:00:00.000Z',
      usedFallback: false,
    }),
    getTaxRulesRevision: vi.fn().mockResolvedValue('tax-rules-2026'),
    getHistoricalAverages: vi.fn().mockResolvedValue({
      inflation: { '1y': 3, '5y': 3, '10y': 3 },
      nbpRate: { '1y': 5, '5y': 5, '10y': 5 },
    }),
    getTaxRulesForYear: vi.fn().mockResolvedValue({
      ikeLimit: '999999.00',
      ikzeLimit: '999999.00',
    }),
    getMultiAssetHistory: vi.fn(),
  };
});

function portfolioPayload(
  overrides: {
    investments?: Array<{
      bondType: BondType;
      amount: number;
      purchaseDate: string;
      isRebought?: boolean;
      taxStrategy?: TaxStrategy;
      rollover?: boolean;
    }>;
    withdrawalDate?: string;
  } = {},
) {
  return {
    investments: overrides.investments ?? [
      {
        bondType: BondType.EDO,
        amount: 10000,
        purchaseDate: '2024-01-01',
        isRebought: false,
        taxStrategy: TaxStrategy.STANDARD,
        rollover: false,
      },
      {
        bondType: BondType.ROR,
        amount: 5000,
        purchaseDate: '2024-07-01',
        isRebought: false,
        taxStrategy: TaxStrategy.STANDARD,
        rollover: true,
      },
    ],
    expectedInflation: 3,
    expectedNbpRate: 5,
    withdrawalDate: overrides.withdrawalDate ?? '2030-01-01',
  };
}

async function calculatePortfolio(overrides?: Parameters<typeof portfolioPayload>[0]) {
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.PORTFOLIO_SIMULATION,
    payload: portfolioPayload(overrides),
  });

  return envelope.result as PortfolioSimulationResult;
}

function monthRow(result: PortfolioSimulationResult, month: string) {
  const row = result.aggregatedTimeline.find((point) => point.date.startsWith(month));

  if (!row) {
    throw new Error(`Expected aggregated timeline row for ${month}.`);
  }

  return row;
}

describe('portfolio simulation aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('starts aggregation at the earliest lot purchase month', async () => {
    const result = await calculatePortfolio();

    expect(result.aggregatedTimeline[0]?.date).toBe('2024-01-01');
    expect(result.summary.totalInvested).toBe(15000);
    expect(result.items).toHaveLength(2);
  });

  it('keeps a 100-lot overview bounded without losing aggregate accounting', async () => {
    const started = performance.now();
    const result = await calculatePortfolio({
      investments: Array.from({ length: 100 }, () => ({
        bondType: BondType.ROR,
        amount: 100,
        purchaseDate: '2024-01-01',
        taxStrategy: TaxStrategy.STANDARD,
        rollover: true,
      })),
      withdrawalDate: '2033-01-01',
    });
    const overview = { ...result, items: [] };
    const detailedBytes = new TextEncoder().encode(JSON.stringify(result)).length;
    const serializedBytes = new TextEncoder().encode(JSON.stringify(overview)).length;
    expect(result.items).toHaveLength(100);
    expect(result.summary.totalInvested).toBe(10_000);
    expect(overview.aggregatedTimeline.at(-1)?.totalNetValue).toBeCloseTo(
      result.summary.totalNetValue,
      6,
    );
    expect(serializedBytes).toBeLessThan(400_000);
    expect(detailedBytes).toBeGreaterThan(serializedBytes);
    // Diagnostic evidence, not a CI timing threshold; recorded with workload.
    process.stdout.write(
      `portfolio benchmark: lots=100 months=108 wallMs=${Math.round(performance.now() - started)} detailBytes=${detailedBytes} overviewBytes=${serializedBytes}\n`,
    );
  }, 60_000);

  it('does not include future lots before their purchase date', async () => {
    const result = await calculatePortfolio();
    const beforeSecondLot = monthRow(result, '2024-06');
    const afterSecondLot = monthRow(result, '2024-07');

    expect(beforeSecondLot.totalNominalValue).toBeGreaterThan(0);
    expect(beforeSecondLot.totalNominalValue).toBeLessThan(12000);
    expect(afterSecondLot.totalNominalValue).toBeGreaterThan(beforeSecondLot.totalNominalValue);
  });

  it('carries latest known values between sparse annual checkpoints', async () => {
    const result = await calculatePortfolio();
    const february = monthRow(result, '2024-02');
    const march = monthRow(result, '2024-03');

    expect(february.totalNetValue).toBeGreaterThan(0);
    expect(march.totalNetValue).toBeGreaterThanOrEqual(february.totalNetValue);
    expect(march.totalProfit).toBeGreaterThanOrEqual(february.totalProfit);
  });

  it('uses redemption fees, not early-exit payout values, in totalFees', async () => {
    const result = await calculatePortfolio({
      withdrawalDate: '2025-01-01',
      investments: [
        {
          bondType: BondType.EDO,
          amount: 10000,
          purchaseDate: '2024-01-01',
          taxStrategy: TaxStrategy.STANDARD,
          rollover: false,
        },
      ],
    });
    const final = result.aggregatedTimeline.at(-1);

    expect(final?.totalFees).toBeGreaterThan(0);
    expect(final?.totalFees).toBeLessThan(10000);
    expect(final?.totalNetValue).toBeGreaterThan(0);
  });

  it('keeps final aggregate summary aligned with final timeline row', async () => {
    const result = await calculatePortfolio();
    const final = result.aggregatedTimeline.at(-1);

    expect(final).toBeDefined();
    expect(result.summary.totalNetValue).toBe(final?.totalNetValue);
    expect(result.summary.totalRealValue).toBe(final?.totalRealValue);
    expect(result.summary.totalProfit).toBe(final?.totalProfit);
  });

  it('includes an off-grid terminal settlement and reconciles each lot', async () => {
    const result = await calculatePortfolio({
      withdrawalDate: '2025-01-15',
      investments: [
        {
          bondType: BondType.TOS,
          amount: 10_000,
          purchaseDate: '2024-01-01',
          taxStrategy: TaxStrategy.STANDARD,
          rollover: false,
        },
      ],
    });
    const final = result.aggregatedTimeline.at(-1);

    expect(final?.date).toBe('2025-01-15');
    expect(final?.totalNetValue).toBeCloseTo(result.items[0]?.result.netPayoutValue ?? 0, 8);
    expect(final?.totalTax).toBeCloseTo(result.items[0]?.result.totalTax ?? 0, 8);
    expect(final?.totalFees).toBeCloseTo(result.items[0]?.result.totalEarlyWithdrawalFee ?? 0, 8);
  });

  it('deflates the aggregate once from the portfolio anchor', async () => {
    const result = await calculatePortfolio();
    const final = result.aggregatedTimeline.at(-1);

    expect(final?.priceIndexFactor).toBeGreaterThan(1);
    expect(final?.totalRealValue).toBeCloseTo(
      (final?.totalNetValue ?? 0) / (final?.priceIndexFactor ?? 1),
      8,
    );
  });

  it('keeps per-lot output traceable to original stored lots', async () => {
    const result = await calculatePortfolio();

    expect(result.items.map((item) => item.bondType)).toEqual([BondType.EDO, BondType.ROR]);
    expect(result.items.map((item) => item.amount)).toEqual([10000, 5000]);
    expect(result.items[0].result.timeline.length).toBeGreaterThan(0);
    expect(result.items[1].result.timeline.length).toBeGreaterThan(0);
  });
});
