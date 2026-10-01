import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaxRulesForYear } from '@/lib/data/market-data';
import { calculationService } from '@/lib/server/calculation/composition';
import { getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import { MonthlyReturn } from '../constants/historical-data';
import {
  BondType,
  CalculationResult,
  InvestmentFrequency,
  RegularInvestmentResult,
  TaxStrategy,
} from '../types';
import {
  BondComparisonScenarioItem,
  RetirementPlannerResult,
  ScenarioKind,
} from '../types/scenarios';
import {
  calculateAssetPerformance,
  calculateBondsPerformance,
  calculateSavingsPerformance,
} from '../utils/asset-calculations';
import { calculationCache } from '../utils/calculation-cache';

const PURCHASE_DATE = '2024-01-01';
const INITIAL_INVESTMENT = 10000;
const warsawMonthFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
});

function formatWarsawMonth(isoDate: string) {
  const parts = warsawMonthFormatter.formatToParts(new Date(isoDate));
  const value = (type: string) => parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}`;
}

type SingleBondFixture = Parameters<typeof calculationService.calculate>[0] & {
  kind: ScenarioKind.SINGLE_BOND;
};
type SingleBondPayload = SingleBondFixture['payload'];
type RegularInvestmentFixture = Parameters<typeof calculationService.calculate>[0] & {
  kind: ScenarioKind.REGULAR_INVESTMENT;
};
type RegularInvestmentPayload = RegularInvestmentFixture['payload'];

const { flatMacroMap } = vi.hoisted(() => {
  const map: Record<string, { inflation?: number; nbpRate?: number }> = {};

  for (let offset = -24; offset <= 360; offset += 1) {
    const date = new Date('2024-01-01T00:00:00.000Z');
    date.setUTCMonth(date.getUTCMonth() + offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    map[key] = {
      inflation: 3,
      nbpRate: 5,
    };
  }

  return { flatMacroMap: map };
});

vi.mock('@/lib/data/market-data', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');

  return {
    getHistoricalDataMap: vi.fn().mockResolvedValue(flatMacroMap),
    getBondDefinitions: vi.fn().mockResolvedValue(Object.values(runtimeDefinitions)),
    getBondDefinitionsMap: vi.fn().mockResolvedValue(runtimeDefinitions),
    getGlobalDataFreshness: vi.fn().mockResolvedValue({
      status: 'fresh',
      asOf: '2024-01',
      lastCheck: '2024-01-01T00:00:00.000Z',
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

function baseBondPayload(
  bondType: BondType,
  horizonMonths: number,
  overrides: Partial<SingleBondPayload> = {},
) {
  const definition = BOND_DEFINITIONS[bondType];

  return {
    bondType,
    initialInvestment: INITIAL_INVESTMENT,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3,
    expectedNbpRate: 5,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate: PURCHASE_DATE,
    withdrawalDate: getWithdrawalDateFromMonths(PURCHASE_DATE, horizonMonths),
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'exact' as const,
    investmentHorizonMonths: horizonMonths,
    ...overrides,
  };
}

function regularPayload(
  bondType: BondType,
  horizonMonths: number,
  overrides: Partial<RegularInvestmentPayload> = {},
) {
  const definition = BOND_DEFINITIONS[bondType];

  return {
    contributionAmount: 1000,
    frequency: InvestmentFrequency.MONTHLY,
    investmentHorizonMonths: horizonMonths,
    bondType,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3,
    expectedNbpRate: 5,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate: PURCHASE_DATE,
    withdrawalDate: getWithdrawalDateFromMonths(PURCHASE_DATE, horizonMonths),
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general' as const,
    ...overrides,
  };
}

async function calculateSingle(
  bondType: BondType,
  horizonMonths: number,
  overrides?: Partial<SingleBondPayload>,
) {
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.SINGLE_BOND,
    payload: baseBondPayload(bondType, horizonMonths, overrides),
  });

  return envelope.result as CalculationResult;
}

function finalPoint(result: CalculationResult) {
  const point = result.timeline.at(-1);

  if (!point) {
    throw new Error('Expected a final timeline point.');
  }

  return point;
}

const assetMetadata = {
  sp500: {
    id: 'sp500',
    name: 'S&P 500',
    color: '#2563eb',
    description: { en: 'Stocks', pl: 'Akcje' },
  },
  bonds: {
    id: 'bonds',
    name: 'EDO bonds',
    color: '#d97706',
    description: { en: 'Bonds', pl: 'Obligacje' },
  },
  savings: {
    id: 'savings',
    name: 'Savings',
    color: '#64748b',
    description: { en: 'Savings', pl: 'Konto' },
  },
};

function multiAssetHistory(months: number): MonthlyReturn[] {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(`${PURCHASE_DATE}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + index);

    return {
      date: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      sp500: index % 6 === 0 ? -2 : 1.2,
      gold: index % 4 === 0 ? 1.4 : 0.3,
      savings: 0.35,
      inflation: 0.25,
      inflationKind: 'month_on_month',
      nbpRate: 5,
    };
  });
}

describe('calculator truth QA scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('weights a limited IKE split by invested principal and falls back when the year has no limit', async () => {
    const wrapperPrincipal = 3000;
    const standardPrincipal = 7000;
    const taxRule = {
      id: '00000000-0000-4000-8000-000000000001',
      year: 2024,
      ikeLimit: String(wrapperPrincipal),
      ikzeLimit: String(wrapperPrincipal),
      standardTaxRate: '19.00',
      ikzePayoutTaxRate: '10.00',
      updatedAt: null,
    };
    vi.mocked(getTaxRulesForYear).mockResolvedValueOnce({
      ...taxRule,
    });
    const split = await calculateSingle(BondType.EDO, 12, {
      initialInvestment: wrapperPrincipal + standardPrincipal,
      taxStrategy: TaxStrategy.IKE,
      useTaxWrapperLimit: true,
    });
    const wrapper = await calculateSingle(BondType.EDO, 12, {
      initialInvestment: wrapperPrincipal,
      taxStrategy: TaxStrategy.IKE,
    });
    const standard = await calculateSingle(BondType.EDO, 12, {
      initialInvestment: standardPrincipal,
      taxStrategy: TaxStrategy.STANDARD,
    });
    expect(split.overflowInfo).toMatchObject({
      amountInWrapper: wrapperPrincipal,
      amountInStandard: standardPrincipal,
    });
    expect(split.netPayoutValue).toBeCloseTo(wrapper.netPayoutValue + standard.netPayoutValue, 8);
    expect(split.totalTax).toBeCloseTo(standard.totalTax, 8);
    expect(split.nominalAnnualizedReturn).toBeCloseTo(
      (wrapper.nominalAnnualizedReturn * wrapperPrincipal +
        standard.nominalAnnualizedReturn * standardPrincipal) /
        (wrapperPrincipal + standardPrincipal),
      8,
    );

    calculationCache.clear();
    vi.mocked(getTaxRulesForYear).mockResolvedValueOnce({
      ...taxRule,
      ikeLimit: '0',
      ikzeLimit: '0',
    });
    const unavailable = await calculateSingle(BondType.EDO, 12, {
      taxStrategy: TaxStrategy.IKE,
      useTaxWrapperLimit: true,
    });
    const allStandard = await calculateSingle(BondType.EDO, 12);
    expect(unavailable.netPayoutValue).toBeCloseTo(allStandard.netPayoutValue, 8);
    expect(unavailable.totalTax).toBeCloseTo(allStandard.totalTax, 8);
  });

  it('locks EDO 10y full-cycle capitalization against accidental early-exit behavior', async () => {
    const result = await calculateSingle(BondType.EDO, 120);
    const final = finalPoint(result);

    expect(result.isEarlyWithdrawal).toBe(false);
    expect(result.totalEarlyWithdrawalFee).toBe(0);
    expect(result.totalTax).toBeGreaterThan(900);
    expect(result.totalTax).toBeLessThan(1300);
    expect(result.netPayoutValue).toBeGreaterThan(13800);
    expect(result.netPayoutValue).toBeLessThan(15500);
    expect(formatWarsawMonth(result.maturityDate)).toBe('2034-01');
    expect(final.isMaturity).toBe(true);
    expect(final.rateSource).toBe('historical_cpi_lag');
  });

  it('locks ROR 20y rollover as a long monthly-payout path, not one native cycle', async () => {
    const result = await calculateSingle(BondType.ROR, 240);
    const final = finalPoint(result);

    expect(result.isEarlyWithdrawal).toBe(false);
    expect(result.timeline.length).toBeGreaterThanOrEqual(240);
    expect(result.finalNominalValue).toBeGreaterThan(INITIAL_INVESTMENT);
    expect(result.totalProfit).toBeGreaterThan(7500);
    expect(result.totalTax).toBeGreaterThan(1700);
    expect(final.cycleIndex).toBeGreaterThan(10);
    expect(final.nbpReference).toBe(5);
  });

  it('keeps DOR 4y ahead of ROR under the same flat NBP path', async () => {
    const dor = await calculateSingle(BondType.DOR, 48);
    const ror = await calculateSingle(BondType.ROR, 48);

    expect(dor.totalProfit).toBeGreaterThan(ror.totalProfit);
    expect(dor.totalTax).toBeGreaterThan(ror.totalTax);
    expect(finalPoint(dor).nbpReference).toBe(5);
    expect(finalPoint(dor).interestRate).toBeCloseTo(5.15, 8);
  });

  it('applies rebuy discount only after the first eligible rollover purchase', async () => {
    const plain = await calculateSingle(BondType.EDO, 240, {
      initialInvestment: 100000,
      isRebought: false,
    });
    const rebought = await calculateSingle(BondType.EDO, 240, {
      initialInvestment: 100000,
      isRebought: true,
    });

    expect(rebought.netPayoutValue).toBeGreaterThan(plain.netPayoutValue);
    expect(rebought.totalProfit).toBeGreaterThan(plain.totalProfit);
    expect(rebought.initialInvestment).toBe(plain.initialInvestment);
    expect(rebought.timeline[0]?.nominalValueBeforeInterest).toBe(
      plain.timeline[0]?.nominalValueBeforeInterest,
    );
  });

  it('keeps early EDO exit below matching full-cycle value and records the fee', async () => {
    const earlyExit = await calculateSingle(BondType.EDO, 36);
    const fullCycle = await calculateSingle(BondType.EDO, 120);

    expect(earlyExit.isEarlyWithdrawal).toBe(true);
    expect(earlyExit.totalEarlyWithdrawalFee).toBeGreaterThan(0);
    expect(earlyExit.netPayoutValue).toBeLessThan(fullCycle.netPayoutValue);
    expect(earlyExit.netPayoutValue).toBeGreaterThanOrEqual(INITIAL_INVESTMENT);
    expect(finalPoint(earlyExit).isWithdrawal).toBe(true);
  });

  it('moves indexed-bond values when yearly CPI path changes', async () => {
    const lowCpi = await calculateSingle(BondType.EDO, 120, {
      customInflation: Array.from({ length: 10 }, () => 1),
    });
    const highCpi = await calculateSingle(BondType.EDO, 120, {
      customInflation: Array.from({ length: 10 }, (_, index) => (index < 3 ? 8 : 4)),
    });

    expect(highCpi.netPayoutValue).toBeGreaterThan(lowCpi.netPayoutValue);
    expect(highCpi.totalTax).toBeGreaterThan(lowCpi.totalTax);
    expect(highCpi.finalRealValue).toBeLessThan(highCpi.netPayoutValue);
  });

  it('keeps a regular 4y DOR plan internally consistent under flat NBP', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.REGULAR_INVESTMENT,
      payload: regularPayload(BondType.DOR, 48),
    });
    const result = envelope.result as RegularInvestmentResult;

    expect(result.totalInvested).toBe(48000);
    expect(result.lots).toHaveLength(48);
    expect(result.timeline).toHaveLength(49);
    expect(result.totalProfit).toBeGreaterThan(2800);
    // Issuer-month settlements replace the old per-calendar-month estimate.
    expect(result.totalTax).toBeGreaterThan(650);
    expect(result.totalEarlyWithdrawalFees).toBeGreaterThan(0);
  });

  it('keeps ladder-style EDO maturity buckets one month apart for a 10y contribution run', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.REGULAR_INVESTMENT,
      payload: regularPayload(BondType.EDO, 120),
    });
    const result = envelope.result as RegularInvestmentResult;
    const firstMaturity = result.lots[0]?.maturityDate
      ? formatWarsawMonth(result.lots[0].maturityDate)
      : undefined;
    const lastLot = result.lots.at(-1);
    const lastMaturity = lastLot ? formatWarsawMonth(lastLot.maturityDate) : undefined;

    expect(result.lots).toHaveLength(120);
    expect(firstMaturity).toBe('2034-01');
    expect(lastMaturity).toBe('2043-12');
    expect(new Set(result.lots.map((lot) => formatWarsawMonth(lot.maturityDate)))).toHaveLength(
      120,
    );
  });

  it('keeps independent comparison equal to matching single output for ROR 20y', async () => {
    const single = await calculateSingle(BondType.ROR, 240);
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.BOND_COMPARISON,
      payload: {
        mode: 'independent',
        sharedConfig: {
          initialInvestment: INITIAL_INVESTMENT,
          purchaseDate: PURCHASE_DATE,
          withdrawalDate: getWithdrawalDateFromMonths(PURCHASE_DATE, 240),
          expectedInflation: 3,
          expectedNbpRate: 5,
          taxStrategy: TaxStrategy.STANDARD,
          timingMode: 'exact',
          investmentHorizonMonths: 240,
        },
        scenarioA: { bondType: BondType.ROR },
        scenarioB: { bondType: BondType.EDO },
      },
    });
    const comparison = (envelope.result as BondComparisonScenarioItem[]).find(
      (item) => item.scenarioKey === 'scenarioA',
    )?.result;

    expect(comparison?.netPayoutValue).toBeCloseTo(single.netPayoutValue, 8);
    expect(comparison?.totalTax).toBeCloseTo(single.totalTax, 8);
    expect(comparison?.timeline.at(-1)?.cycleEndDate).toBe(single.timeline.at(-1)?.cycleEndDate);
  });

  it('keeps retirement steady-rate model sustainable for a conservative EDO drawdown case', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.RETIREMENT_PLANNER,
      payload: {
        initialCapital: 500000,
        monthlyWithdrawal: 2500,
        expectedInflation: 3,
        expectedNbpRate: 5,
        bondType: BondType.EDO,
        taxStrategy: TaxStrategy.STANDARD,
        horizonYears: 20,
      },
    });
    const result = envelope.result as RetirementPlannerResult;

    expect(result.isSustainable).toBe(true);
    expect(result.exhaustionDate).toBeUndefined();
    expect(result.timeline).toHaveLength(241);
    expect(result.totalWithdrawn).toBe(600000);
    expect(result.finalBalance).toBeGreaterThan(200000);
    expect(result.modeledAnnualRate).toBeCloseTo(5, 0);
  });

  it('keeps multi-asset pure calculations deterministic for fallback history', () => {
    const history = multiAssetHistory(60);
    const stocks = calculateAssetPerformance(10000, 500, 'sp500', assetMetadata.sp500, history);
    const bonds = calculateBondsPerformance(10000, 500, assetMetadata.bonds, history);
    const savings = calculateSavingsPerformance(10000, 500, assetMetadata.savings, history);

    expect(stocks.series).toHaveLength(61);
    expect(bonds.series).toHaveLength(61);
    expect(savings.series).toHaveLength(61);
    expect(stocks.series.at(-1)?.value).toBeGreaterThan(45000);
    expect(bonds.series.at(-1)?.realValue).toBeGreaterThan(38000);
    expect(savings.series.at(-1)?.percentChange).toBeCloseTo(0.4868, 3);
    expect(Math.max(...stocks.series.map((point) => point.drawdown))).toBeGreaterThan(0);
  });
});
