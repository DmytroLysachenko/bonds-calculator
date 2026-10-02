import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';
import { buildBondTimelineDisplayRows } from '@/shared/lib/bond-display';
import { getWithdrawalDateFromMonths, toDateString } from '@/shared/lib/date-timing';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import {
  BondComparisonScenarioItem,
  BondType,
  CalculationResult,
  InvestmentFrequency,
  RegularInvestmentResult,
  TaxStrategy,
  YearlyTimelinePoint,
} from '../types';
import { ScenarioKind } from '../types/scenarios';
import { calculationCache } from '../utils/calculation-cache';
import { calculateBondInvestment } from '../utils/calculations';

const today = new Date('2026-05-05T00:00:00.000Z');

vi.mock('@/lib/data/market-data', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');

  const historicalMap: Record<string, { inflation?: number; nbpRate?: number }> = {};
  const baseDate = new Date('2026-05-05T00:00:00.000Z');

  for (let offset = -24; offset <= 180; offset += 1) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    historicalMap[key] = {
      inflation: 3 + (offset % 6) * 0.1,
      nbpRate: 5 + (offset % 4) * 0.15,
    };
  }

  return {
    getHistoricalDataMap: vi.fn().mockImplementation(async () => historicalMap),
    getBondDefinitions: vi.fn().mockResolvedValue(Object.values(runtimeDefinitions)),
    getBondDefinitionsMap: vi.fn().mockResolvedValue(runtimeDefinitions),
    getGlobalDataFreshness: vi.fn().mockResolvedValue({
      status: 'fresh',
      asOf: '2026-04',
      lastCheck: '2026-05-05T00:00:00.000Z',
      usedFallback: false,
    }),
    getTaxRulesRevision: vi.fn().mockResolvedValue('tax-rules-2026'),
    getHistoricalAverages: vi.fn().mockResolvedValue({
      inflation: { '1y': 3.2, '5y': 4.1, '10y': 3.6 },
      nbpRate: { '1y': 5.4, '5y': 4.7, '10y': 4.1 },
    }),
    getTaxRulesForYear: vi.fn().mockResolvedValue({
      ikeLimit: '999999.00',
      ikzeLimit: '999999.00',
    }),
    getMultiAssetHistory: vi.fn(),
  };
});

function buildSingleBondPayload(
  bondType: BondType,
  investmentHorizonMonths: number,
  taxStrategy = TaxStrategy.STANDARD,
) {
  const definition = BOND_DEFINITIONS[bondType];
  const purchaseDate = toDateString(today);

  return {
    bondType,
    initialInvestment: 10000,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3.5,
    expectedNbpRate: 5.25,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, investmentHorizonMonths),
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy,
    timingMode: 'exact' as const,
    investmentHorizonMonths,
    rollover: false,
  };
}

function buildRegularInvestmentPayload(bondType: BondType, investmentHorizonMonths: number) {
  const definition = BOND_DEFINITIONS[bondType];
  const purchaseDate = toDateString(today);

  return {
    contributionAmount: 1000,
    frequency: InvestmentFrequency.MONTHLY,
    investmentHorizonMonths,
    bondType,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3.5,
    expectedNbpRate: 5.25,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, investmentHorizonMonths),
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general' as const,
  };
}

async function getSingleBondResult(
  bondType: BondType,
  investmentHorizonMonths: number,
  taxStrategy = TaxStrategy.STANDARD,
) {
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.SINGLE_BOND,
    payload: buildSingleBondPayload(bondType, investmentHorizonMonths, taxStrategy),
  });

  return envelope.result as CalculationResult;
}

function expectChronologicalTimeline(timeline: YearlyTimelinePoint[]) {
  for (let index = 1; index < timeline.length; index += 1) {
    const previous = new Date(timeline[index - 1].cycleEndDate).getTime();
    const current = new Date(timeline[index].cycleEndDate).getTime();
    expect(current).toBeGreaterThanOrEqual(previous);
  }
}

function expectFiniteTimelineValues(timeline: YearlyTimelinePoint[]) {
  for (const point of timeline) {
    expect(Number.isFinite(point.nominalValueBeforeInterest)).toBe(true);
    expect(Number.isFinite(point.interestEarned)).toBe(true);
    expect(Number.isFinite(point.taxDeducted)).toBe(true);
    expect(Number.isFinite(point.netInterest)).toBe(true);
    expect(Number.isFinite(point.nominalValueAfterInterest)).toBe(true);
    expect(Number.isFinite(point.totalValue)).toBe(true);
    expect(Number.isFinite(point.realValue)).toBe(true);
    expect(point.totalValue).toBeGreaterThanOrEqual(0);
    expect(point.realValue).toBeGreaterThanOrEqual(0);
  }
}

describe('Display-facing single-bond invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('keeps maturity scenarios chronologically ordered and reconcilable', async () => {
    const ots = await getSingleBondResult(BondType.OTS, 3);
    const ror = await getSingleBondResult(BondType.ROR, 12);
    const tos = await getSingleBondResult(BondType.TOS, 36);
    const edo = await getSingleBondResult(BondType.EDO, 120);

    for (const result of [ots, ror, tos, edo]) {
      expect(result.timeline.length).toBeGreaterThan(0);
      expectChronologicalTimeline(result.timeline);
      expectFiniteTimelineValues(result.timeline);

      const finalPoint = result.timeline.at(-1);
      expect(finalPoint).toBeDefined();
      expect(finalPoint?.isWithdrawal).toBe(true);
      expect(finalPoint?.isMaturity).toBe(true);

      expect(result.grossValue - result.totalTax - result.totalEarlyWithdrawalFee).toBeCloseTo(
        result.netPayoutValue,
        6,
      );
      expect(finalPoint?.totalValue).toBeCloseTo(result.netPayoutValue, 6);
      expect(finalPoint?.realValue).toBeCloseTo(result.finalRealValue, 6);
      expect(new Date(result.maturityDate).getTime()).toBeGreaterThanOrEqual(
        new Date(finalPoint?.cycleEndDate ?? '').getTime(),
      );
    }
  });

  it('keeps early-withdrawal scenarios internally consistent and clearly non-maturity exits', async () => {
    const coiEarly = await getSingleBondResult(BondType.COI, 24);
    const edoEarly = await getSingleBondResult(BondType.EDO, 60);

    for (const result of [coiEarly, edoEarly]) {
      expect(result.isEarlyWithdrawal).toBe(true);
      expect(result.totalEarlyWithdrawalFee).toBeGreaterThan(0);
      expect(result.totalTax).toBeGreaterThanOrEqual(0);
      expectChronologicalTimeline(result.timeline);
      expectFiniteTimelineValues(result.timeline);

      const finalPoint = result.timeline.at(-1);
      expect(finalPoint).toBeDefined();
      expect(finalPoint?.isWithdrawal).toBe(true);
      expect(finalPoint?.isMaturity).toBe(false);
      expect(new Date(finalPoint?.cycleEndDate ?? '').getTime()).toBeLessThan(
        new Date(result.maturityDate).getTime(),
      );
      expect(result.grossValue - result.totalTax - result.totalEarlyWithdrawalFee).toBeCloseTo(
        result.netPayoutValue,
        6,
      );
      expect(finalPoint?.totalValue).toBeCloseTo(result.netPayoutValue, 6);
      expect(finalPoint?.realValue).toBeCloseTo(result.finalRealValue, 6);
    }
  });

  it('keeps projected inflation-linked deflation scenarios non-negative and ordered', () => {
    const result = calculateBondInvestment({
      ...buildSingleBondPayload(BondType.EDO, 120),
      firstYearRate: 0,
      expectedInflation: -10,
      expectedNbpRate: 0,
      margin: 0,
    });

    expect(result.grossValue).toBeGreaterThanOrEqual(result.initialInvestment);
    expect(result.totalProfit).toBeGreaterThanOrEqual(0);
    expectChronologicalTimeline(result.timeline);
    expectFiniteTimelineValues(result.timeline);

    for (const point of result.timeline) {
      expect(point.interestRate).toBeGreaterThanOrEqual(0);
      expect(point.nominalValueAfterInterest).toBeGreaterThanOrEqual(
        point.nominalValueBeforeInterest,
      );
      expect(point.totalValue).toBeLessThanOrEqual(result.netPayoutValue);
    }
  });

  it('shows monthly payout checkpoints as cumulative investor wealth instead of zero-gain placeholders', async () => {
    const ror = await getSingleBondResult(BondType.ROR, 12);
    const dor = await getSingleBondResult(BondType.DOR, 24);

    for (const result of [ror, dor]) {
      const nonInitialPoints = result.timeline.slice(1);
      expect(nonInitialPoints.length).toBeGreaterThan(0);

      expect(nonInitialPoints.some((point) => point.accumulatedNetInterest > 0)).toBe(true);
      expect(nonInitialPoints.some((point) => point.netProfit !== 0)).toBe(true);
      expect(nonInitialPoints.some((point) => point.earlyWithdrawalValue > 0)).toBe(true);

      const displayRows = buildBondTimelineDisplayRows(result.timeline, 'en');
      expect(displayRows.some((row) => row.paidOutCash > 0)).toBe(true);
      expect(displayRows.some((row) => row.totalWealth >= row.principalValue)).toBe(true);

      for (let index = 1; index < displayRows.length; index += 1) {
        expect(displayRows[index].paidOutCash).toBeGreaterThanOrEqual(
          displayRows[index - 1].paidOutCash,
        );
      }

      for (let index = 2; index < result.timeline.length; index += 1) {
        const previous = new Date(result.timeline[index - 1].cycleEndDate).getTime();
        const current = new Date(result.timeline[index].cycleEndDate).getTime();
        expect(current).toBeGreaterThan(previous);
      }
    }
  });

  it('keeps early-exit values below or equal to total wealth at each checkpoint', async () => {
    const ror = await getSingleBondResult(BondType.ROR, 48);

    for (const point of ror.timeline.slice(1)) {
      expect(point.earlyWithdrawalValue).toBeGreaterThanOrEqual(0);
      expect(point.earlyWithdrawalValue).toBeLessThanOrEqual(point.totalValue);
    }
  });

  it('keeps DOR ahead of ROR under the same NBP path because of the higher margin', async () => {
    const ror = await getSingleBondResult(BondType.ROR, 24);
    const dor = await getSingleBondResult(BondType.DOR, 24);

    expect(dor.netPayoutValue).toBeGreaterThan(ror.netPayoutValue);
    expect(dor.totalProfit).toBeGreaterThan(ror.totalProfit);
  });

  it('uses the first floating period as the offer rate and later periods as NBP plus margin', async () => {
    const ror = await getSingleBondResult(BondType.ROR, 24);
    const dor = await getSingleBondResult(BondType.DOR, 24);

    const [rorMonthOne, rorMonthTwo] = ror.timeline.slice(1, 3);
    const [dorMonthOne, dorMonthTwo] = dor.timeline.slice(1, 3);

    expect(rorMonthOne?.interestRate).toBeCloseTo(BOND_DEFINITIONS.ROR.firstYearRate, 6);
    expect(rorMonthOne?.rateSource).toBe('first_year_fixed');
    expect(rorMonthTwo?.interestRate).toBeCloseTo((rorMonthTwo?.rateReferenceValue ?? 0) + 0, 6);
    expect(rorMonthTwo?.rateSource).toBe('historical_nbp');

    expect(dorMonthOne?.interestRate).toBeCloseTo(BOND_DEFINITIONS.DOR.firstYearRate, 6);
    expect(dorMonthOne?.rateSource).toBe('first_year_fixed');
    expect(dorMonthTwo?.interestRate).toBeCloseTo((dorMonthTwo?.rateReferenceValue ?? 0) + 0.15, 6);
    expect(dorMonthTwo?.rateSource).toBe('historical_nbp');
  });

  it('automatically rolls short bonds across a longer single-calculator horizon', async () => {
    const ror = await getSingleBondResult(BondType.ROR, 48);

    expect(ror.timeline.some((point) => point.cycleIndex > 1)).toBe(true);
    expect((ror.calculationNotes ?? []).some((note) => note.includes('Simulation covered'))).toBe(
      true,
    );
    expect(ror.isEarlyWithdrawal).toBe(false);
  });

  it('uses projected CPI plus margin after the first year for indexed bonds', () => {
    const result = calculateBondInvestment({
      ...buildSingleBondPayload(BondType.EDO, 120),
      expectedInflation: 2.5,
      customInflation: Array(10).fill(2.5),
      firstYearRate: 5.35,
      margin: 2,
      historicalData: {},
    });
    const secondYearPoint = result.timeline[2];

    expect(secondYearPoint?.interestRate).toBeCloseTo(4.5, 6);
    expect(secondYearPoint?.rateSource).toBe('projected_cpi');
    expect(secondYearPoint?.inflationReference).toBeCloseTo(2.5, 6);
  });

  it('changes projected indexed-bond outcomes when the expected CPI path changes', () => {
    const lowResult = calculateBondInvestment({
      ...buildSingleBondPayload(BondType.EDO, 240),
      expectedInflation: 1,
      firstYearRate: 5.35,
      margin: 2,
      historicalData: {},
    });
    const highResult = calculateBondInvestment({
      ...buildSingleBondPayload(BondType.EDO, 240),
      expectedInflation: 5,
      firstYearRate: 5.35,
      margin: 2,
      historicalData: {},
    });

    expect(highResult.timeline[2]?.interestRate).toBeGreaterThan(
      lowResult.timeline[2]?.interestRate ?? 0,
    );
    expect(highResult.netPayoutValue).toBeGreaterThan(lowResult.netPayoutValue);
  });
});

describe('Display-facing regular-investment invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('keeps regular-investment timelines ordered and aggregate totals sane', async () => {
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.REGULAR_INVESTMENT,
      payload: buildRegularInvestmentPayload(BondType.COI, 48),
    });

    const result = envelope.result as RegularInvestmentResult;

    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.lots.length).toBe(48);
    expect(result.totalInvested).toBe(48000);

    for (let index = 1; index < result.timeline.length; index += 1) {
      const previous = new Date(result.timeline[index - 1].date).getTime();
      const current = new Date(result.timeline[index].date).getTime();
      expect(current).toBeGreaterThanOrEqual(previous);
    }

    const finalPoint = result.timeline.at(-1);
    expect(finalPoint).toBeDefined();
    expect(finalPoint?.nominalValue).toBeCloseTo(result.finalNominalValue, 6);
    expect(finalPoint?.realValue).toBeCloseTo(result.finalRealValue, 6);
    expect(finalPoint?.totalInvested).toBe(result.totalInvested);
    expect(result.totalTax).toBeGreaterThanOrEqual(0);
    expect(result.totalEarlyWithdrawalFees).toBeGreaterThanOrEqual(0);
    expect(result.totalProfit).toBeGreaterThan(0);
    expect(result.timeline.length).toBe(49);
  });

  it('changes indexed regular-investment outcomes when custom inflation overrides change', async () => {
    const purchaseDate = toDateString(today);
    const [lowEnvelope, highEnvelope] = await Promise.all([
      calculationService.calculate({
        kind: ScenarioKind.REGULAR_INVESTMENT,
        payload: {
          ...buildRegularInvestmentPayload(BondType.EDO, 120),
          purchaseDate,
          withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, 120),
          expectedInflation: 2.5,
          customInflation: Array(10).fill(2.5),
        },
      }),
      calculationService.calculate({
        kind: ScenarioKind.REGULAR_INVESTMENT,
        payload: {
          ...buildRegularInvestmentPayload(BondType.EDO, 120),
          purchaseDate,
          withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, 120),
          expectedInflation: 2.5,
          customInflation: Array(10).fill(5),
        },
      }),
    ]);

    const lowResult = lowEnvelope.result as RegularInvestmentResult;
    const highResult = highEnvelope.result as RegularInvestmentResult;

    expect(highResult.finalNominalValue).toBeGreaterThan(lowResult.finalNominalValue);
    expect(highResult.totalProfit).toBeGreaterThan(lowResult.totalProfit);
  });
});

describe('Comparison override invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('keeps shared timing and tax defaults unless a scenario explicitly overrides them', async () => {
    const purchaseDate = toDateString(today);
    const sharedHorizonMonths = 24;

    const envelope = await calculationService.calculate({
      kind: ScenarioKind.BOND_COMPARISON,
      payload: {
        mode: 'independent',
        sharedConfig: {
          initialInvestment: 10000,
          purchaseDate,
          withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, sharedHorizonMonths),
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          taxStrategy: TaxStrategy.STANDARD,
          timingMode: 'general',
          investmentHorizonMonths: sharedHorizonMonths,
        },
        scenarioA: {
          bondType: BondType.COI,
        },
        scenarioB: {
          bondType: BondType.COI,
          taxStrategy: TaxStrategy.IKE,
          investmentHorizonMonths: 12,
        },
      },
    });

    const comparisonResult = envelope.result as BondComparisonScenarioItem[];
    const scenarioA = comparisonResult.find((item) => item.scenarioKey === 'scenarioA')?.result;
    const scenarioB = comparisonResult.find((item) => item.scenarioKey === 'scenarioB')?.result;

    expect(scenarioA).toBeDefined();
    expect(scenarioB).toBeDefined();
    expect(scenarioA?.totalTax).toBeGreaterThan(0);
    expect(scenarioB?.totalTax).toBe(0);
    expect(scenarioA?.timeline.length).toBeGreaterThan(scenarioB?.timeline.length ?? 0);
    expect(new Date(scenarioA?.timeline.at(-1)?.cycleEndDate ?? '').getTime()).toBeGreaterThan(
      new Date(scenarioB?.timeline.at(-1)?.cycleEndDate ?? '').getTime(),
    );
  });

  it('automatically rolls short bonds in comparison scenarios when the shared horizon exceeds one native term', async () => {
    const purchaseDate = toDateString(today);
    const sharedHorizonMonths = 48;

    const envelope = await calculationService.calculate({
      kind: ScenarioKind.BOND_COMPARISON,
      payload: {
        mode: 'independent',
        sharedConfig: {
          initialInvestment: 10000,
          purchaseDate,
          withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, sharedHorizonMonths),
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          taxStrategy: TaxStrategy.STANDARD,
          timingMode: 'general',
          investmentHorizonMonths: sharedHorizonMonths,
        },
        scenarioA: {
          bondType: BondType.ROR,
        },
        scenarioB: {
          bondType: BondType.DOR,
        },
      },
    });

    const comparisonResult = envelope.result as BondComparisonScenarioItem[];
    const scenarioA = comparisonResult.find((item) => item.scenarioKey === 'scenarioA')?.result;
    const scenarioB = comparisonResult.find((item) => item.scenarioKey === 'scenarioB')?.result;

    expect(scenarioA?.timeline.some((point) => point.cycleIndex > 1)).toBe(true);
    expect(scenarioB?.timeline.some((point) => point.cycleIndex > 1)).toBe(true);
    expect(scenarioA?.isEarlyWithdrawal).toBe(false);
    expect(scenarioB?.isEarlyWithdrawal).toBe(false);
  });
});
