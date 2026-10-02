import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import { BondInputs, BondType, CalculationResult, TaxStrategy } from '../types';
import {
  BondComparisonScenarioItem,
  BondOptimizerResult,
  PortfolioSimulationResult,
  ScenarioKind,
} from '../types/scenarios';
import { BondComparisonScenarioRequestSchema } from '../types/schemas';
import { calculationCache } from '../utils/calculation-cache';

vi.mock('@/lib/data/market-data', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');
  const historicalMap: Record<string, { inflation?: number; nbpRate?: number }> = {};
  const start = new Date('2026-01-01T00:00:00.000Z');

  for (let offset = -24; offset <= 360; offset += 1) {
    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() + offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    historicalMap[key] = {
      inflation: 3 + (offset % 4) * 0.1,
      nbpRate: 5 + (offset % 3) * 0.1,
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
      inflation: { '1y': 3.1, '5y': 3.2, '10y': 3.3 },
      nbpRate: { '1y': 5.1, '5y': 5.2, '10y': 5.3 },
    }),
    getTaxRulesForYear: vi.fn().mockResolvedValue({
      ikeLimit: '999999.00',
      ikzeLimit: '999999.00',
    }),
    getMultiAssetHistory: vi.fn(),
  };
});

vi.mock('@/lib/server/bonds/offer-terms', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');

  return {
    resolveBondOfferTerms: vi.fn().mockImplementation((bondType: BondType) => {
      const definition = runtimeDefinitions[bondType];

      return Promise.resolve({
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        source: 'definition-fallback',
      });
    }),
  };
});

const purchaseDate = '2026-01-01';
const withdrawalDate = '2036-01-01';
const initialInvestment = 10000;

function singlePayload(bondType: BondType, overrides: Partial<BondInputs> = {}) {
  const definition = BOND_DEFINITIONS[bondType];

  return {
    bondType,
    initialInvestment,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3,
    expectedNbpRate: 5,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate,
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'exact' as const,
    investmentHorizonMonths: 120,
    rollover: false,
    ...overrides,
  };
}

async function calculateSingle(
  bondType: BondType,
  overrides?: Parameters<typeof singlePayload>[1],
) {
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.SINGLE_BOND,
    payload: singlePayload(bondType, overrides),
  });

  return envelope.result as CalculationResult;
}

async function calculateComparisonScenarioA(
  bondType: BondType,
  sharedOverrides: Partial<{
    initialInvestment: number;
    purchaseDate: string;
    withdrawalDate: string;
    expectedInflation: number;
    expectedNbpRate: number;
    taxStrategy: TaxStrategy;
    timingMode: 'exact';
    investmentHorizonMonths: number;
    customInflation: number[];
    customNbpRate: number[];
  }> = {},
) {
  const comparisonEnvelope = await calculationService.calculate({
    kind: ScenarioKind.BOND_COMPARISON,
    payload: {
      mode: 'independent',
      sharedConfig: {
        initialInvestment,
        purchaseDate,
        withdrawalDate,
        expectedInflation: 3,
        expectedNbpRate: 5,
        taxStrategy: TaxStrategy.STANDARD,
        timingMode: 'exact',
        investmentHorizonMonths: 120,
        ...sharedOverrides,
      },
      scenarioA: { bondType },
      scenarioB: { bondType: BondType.EDO },
    },
  });

  return (comparisonEnvelope.result as BondComparisonScenarioItem[]).find(
    (item) => item.scenarioKey === 'scenarioA',
  )?.result;
}

function expectCloseResult(left: CalculationResult, right: CalculationResult) {
  expect(left.netPayoutValue).toBeCloseTo(right.netPayoutValue, 8);
  expect(left.totalTax).toBeCloseTo(right.totalTax, 8);
  expect(left.totalProfit).toBeCloseTo(right.totalProfit, 8);
  expect(left.finalRealValue).toBeCloseTo(right.finalRealValue, 8);
}

describe('cross-calculator consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('keeps independent comparison output equal to matching single EDO scenario', async () => {
    const single = await calculateSingle(BondType.EDO);
    const comparisonEnvelope = await calculationService.calculate({
      kind: ScenarioKind.BOND_COMPARISON,
      payload: {
        mode: 'independent',
        sharedConfig: {
          initialInvestment,
          purchaseDate,
          withdrawalDate,
          expectedInflation: 3,
          expectedNbpRate: 5,
          taxStrategy: TaxStrategy.STANDARD,
          timingMode: 'exact',
          investmentHorizonMonths: 120,
        },
        scenarioA: { bondType: BondType.EDO },
        scenarioB: { bondType: BondType.ROR },
      },
    });
    const comparison = (comparisonEnvelope.result as BondComparisonScenarioItem[]).find(
      (item) => item.scenarioKey === 'scenarioA',
    )?.result;

    expect(comparison).toBeDefined();
    expectCloseResult(single, comparison!);
  });

  it.each([
    BondType.OTS,
    BondType.ROR,
    BondType.DOR,
    BondType.TOS,
    BondType.COI,
    BondType.EDO,
    BondType.ROS,
    BondType.ROD,
  ])(
    'keeps independent comparison output equal to matching single %s scenario',
    async (bondType) => {
      const single = await calculateSingle(bondType);
      const comparisonEnvelope = await calculationService.calculate({
        kind: ScenarioKind.BOND_COMPARISON,
        payload: {
          mode: 'independent',
          sharedConfig: {
            initialInvestment,
            purchaseDate,
            withdrawalDate,
            expectedInflation: 3,
            expectedNbpRate: 5,
            taxStrategy: TaxStrategy.STANDARD,
            timingMode: 'exact',
            investmentHorizonMonths: 120,
          },
          scenarioA: { bondType },
          scenarioB: { bondType: BondType.EDO },
        },
      });
      const comparison = (comparisonEnvelope.result as BondComparisonScenarioItem[]).find(
        (item) => item.scenarioKey === 'scenarioA',
      )?.result;

      expect(comparison).toBeDefined();
      expectCloseResult(single, comparison!);
      expect(comparison!.timeline.at(-1)?.cycleEndDate).toBe(single.timeline.at(-1)?.cycleEndDate);
    },
  );

  it.each([
    [BondType.EDO, '2028-01-01', 24],
    [BondType.ROR, '2026-07-01', 6],
    [BondType.DOR, '2027-01-01', 12],
  ] as const)(
    'keeps early-withdrawal %s comparison output equal to matching single scenario',
    async (bondType, withdrawalDateOverride, horizonMonths) => {
      const single = await calculateSingle(bondType, {
        withdrawalDate: withdrawalDateOverride,
        investmentHorizonMonths: horizonMonths,
        rollover: false,
      });
      const comparison = await calculateComparisonScenarioA(bondType, {
        withdrawalDate: withdrawalDateOverride,
        investmentHorizonMonths: horizonMonths,
      });

      expect(comparison).toBeDefined();
      expectCloseResult(single, comparison!);
      expect(comparison!.totalEarlyWithdrawalFee ?? 0).toBeCloseTo(
        single.totalEarlyWithdrawalFee ?? 0,
        8,
      );
    },
  );

  it('keeps portfolio single-lot output equal to matching single ROR scenario', async () => {
    const single = await calculateSingle(BondType.ROR, {
      rollover: true,
      investmentHorizonMonths: 120,
    });
    const portfolioEnvelope = await calculationService.calculate({
      kind: ScenarioKind.PORTFOLIO_SIMULATION,
      payload: {
        investments: [
          {
            bondType: BondType.ROR,
            amount: initialInvestment,
            purchaseDate,
            taxStrategy: TaxStrategy.STANDARD,
            rollover: true,
          },
        ],
        expectedInflation: 3,
        expectedNbpRate: 5,
        withdrawalDate,
      },
    });
    const portfolio = portfolioEnvelope.result as PortfolioSimulationResult;

    expect(portfolio.items).toHaveLength(1);
    expectCloseResult(single, portfolio.items[0].result);
  });

  it('keeps optimizer item result aligned with direct single-bond run for same winner', async () => {
    const optimizerEnvelope = await calculationService.calculate({
      kind: ScenarioKind.BOND_OPTIMIZER,
      payload: {
        initialInvestment,
        purchaseDate,
        withdrawalDate,
        expectedInflation: 3,
        expectedNbpRate: 5,
        taxStrategy: TaxStrategy.STANDARD,
        includeFamilyBonds: false,
      },
    });
    const optimizer = optimizerEnvelope.result as BondOptimizerResult;
    const direct = await calculateSingle(optimizer.highestPayout.bondType, {
      rollover: true,
    });

    expect(optimizer.highestPayout.netPayoutValue).toBeCloseTo(direct.netPayoutValue, 8);
    expect(optimizer.highestPayout.totalProfit).toBeCloseTo(direct.totalProfit, 8);
    expect(optimizer.highestPayout.result.timeline.at(-1)?.cycleEndDate).toBe(
      direct.timeline.at(-1)?.cycleEndDate,
    );
  });

  it('keeps tax-wrapper ordering stable across direct and optimizer results', async () => {
    const standard = await calculateSingle(BondType.EDO, { taxStrategy: TaxStrategy.STANDARD });
    const ike = await calculateSingle(BondType.EDO, { taxStrategy: TaxStrategy.IKE });
    const ikze = await calculateSingle(BondType.EDO, { taxStrategy: TaxStrategy.IKZE });

    expect(ike.netPayoutValue).toBeGreaterThan(standard.netPayoutValue);
    expect(standard.netPayoutValue).toBeGreaterThan(ikze.netPayoutValue);
    expect(ike.totalTax).toBe(0);
    expect(ikze.totalTax).toBeGreaterThan(standard.totalTax);
  });

  it('rejects rebuy discount comparison overrides instead of silently ignoring them', async () => {
    const plain = await calculateSingle(BondType.EDO, {
      initialInvestment: 100000,
      isRebought: false,
      investmentHorizonMonths: 240,
      withdrawalDate: '2046-01-01',
    });
    const rebought = await calculateSingle(BondType.EDO, {
      initialInvestment: 100000,
      isRebought: true,
      investmentHorizonMonths: 240,
      withdrawalDate: '2046-01-01',
    });
    expect(
      BondComparisonScenarioRequestSchema.safeParse({
        kind: ScenarioKind.BOND_COMPARISON,
        payload: {
          mode: 'independent',
          sharedConfig: {
            initialInvestment: 100000,
            purchaseDate,
            withdrawalDate: '2046-01-01',
            expectedInflation: 3,
            expectedNbpRate: 5,
            taxStrategy: TaxStrategy.STANDARD,
            timingMode: 'exact',
            investmentHorizonMonths: 240,
          },
          scenarioA: { bondType: BondType.EDO, isRebought: false },
          scenarioB: { bondType: BondType.EDO, isRebought: true },
        },
      }).success,
    ).toBe(false);

    expect(rebought.netPayoutValue).toBeGreaterThan(plain.netPayoutValue);
  });

  it('keeps custom CPI path effect consistent between single and comparison', async () => {
    const lowPath = Array.from({ length: 10 }, () => 1);
    const highPath = Array.from({ length: 10 }, () => 6);
    const lowSingle = await calculateSingle(BondType.EDO, { customInflation: lowPath });
    const highSingle = await calculateSingle(BondType.EDO, { customInflation: highPath });
    const comparisonEnvelope = await calculationService.calculate({
      kind: ScenarioKind.BOND_COMPARISON,
      payload: {
        mode: 'independent',
        sharedConfig: {
          initialInvestment,
          purchaseDate,
          withdrawalDate,
          expectedInflation: 3,
          expectedNbpRate: 5,
          taxStrategy: TaxStrategy.STANDARD,
          timingMode: 'exact',
          investmentHorizonMonths: 120,
          customInflation: highPath,
        },
        scenarioA: { bondType: BondType.EDO },
        scenarioB: { bondType: BondType.ROR },
      },
    });
    const highComparison = (comparisonEnvelope.result as BondComparisonScenarioItem[]).find(
      (item) => item.scenarioKey === 'scenarioA',
    )?.result;

    expect(highSingle.netPayoutValue).toBeGreaterThan(lowSingle.netPayoutValue);
    expect(highComparison).toBeDefined();
    expectCloseResult(highSingle, highComparison!);
  });
});
