import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';
import { getWithdrawalDateFromMonths, toDateString } from '@/shared/lib/date-timing';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
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
import { calculationCache } from '../utils/calculation-cache';

const today = new Date('2026-05-05T00:00:00.000Z');
const warsawDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatWarsawDate(isoDate: string) {
  const parts = warsawDateFormatter.formatToParts(new Date(isoDate));
  const value = (type: string) => parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

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

function buildSingleBondPayload(bondType: BondType, taxStrategy = TaxStrategy.STANDARD) {
  const definition = BOND_DEFINITIONS[bondType];
  const purchaseDate = toDateString(today);
  const investmentHorizonMonths = Math.max(1, Math.round(definition.duration * 12));

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

async function getSingleBondResult(bondType: BondType, taxStrategy = TaxStrategy.STANDARD) {
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.SINGLE_BOND,
    payload: buildSingleBondPayload(bondType, taxStrategy),
  });

  return envelope.result as CalculationResult;
}

describe('Flagship calculation regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  describe('single-bond benchmark cases', () => {
    it('keeps the EDO baseline within a trustworthy range for a 10-year standard scenario', async () => {
      const result = await getSingleBondResult(BondType.EDO);

      expect(result.netPayoutValue).toBeGreaterThan(14900);
      expect(result.netPayoutValue).toBeLessThan(18000);
      expect(result.totalTax).toBeGreaterThan(1000);
      expect(result.totalTax).toBeLessThan(2000);
      expect(result.totalProfit).toBeGreaterThan(4900);
      expect(result.totalProfit).toBeLessThan(8000);
      expect(result.nominalAnnualizedReturn).toBeGreaterThan(4);
      expect(result.nominalAnnualizedReturn).toBeLessThan(6);
      expect(formatWarsawDate(result.maturityDate)).toBe('2036-05-05');
    });

    it('keeps the TOS baseline within a trustworthy range for a 3-year standard scenario', async () => {
      const result = await getSingleBondResult(BondType.TOS);

      expect(result.netPayoutValue).toBeGreaterThan(10800);
      expect(result.netPayoutValue).toBeLessThan(12000);
      expect(result.totalTax).toBeGreaterThan(200);
      expect(result.totalTax).toBeLessThan(400);
      expect(result.totalProfit).toBeGreaterThan(800);
      expect(result.totalProfit).toBeLessThan(1500);
      expect(result.nominalAnnualizedReturn).toBeGreaterThan(3);
      expect(result.nominalAnnualizedReturn).toBeLessThan(5);
      expect(formatWarsawDate(result.maturityDate)).toBe('2029-05-05');
    });

    it('keeps the ROR baseline within a trustworthy range for a 1-year standard scenario', async () => {
      const result = await getSingleBondResult(BondType.ROR);

      expect(result.netPayoutValue).toBeGreaterThan(10300);
      expect(result.netPayoutValue).toBeLessThan(10600);
      expect(result.totalTax).toBeGreaterThan(50);
      expect(result.totalTax).toBeLessThan(150);
      expect(result.totalProfit).toBeGreaterThan(300);
      expect(result.totalProfit).toBeLessThan(500);
      expect(result.nominalAnnualizedReturn).toBeGreaterThan(3.5);
      expect(result.nominalAnnualizedReturn).toBeLessThan(5);
      expect(formatWarsawDate(result.maturityDate)).toBe('2027-05-05');
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
      'keeps %s native-term rate semantics aligned with official bond family rules',
      async (bondType) => {
        const definition = BOND_DEFINITIONS[bondType];
        const result = await getSingleBondResult(bondType);
        const nonInitialPoints = result.timeline.filter((point) => point.cycleIndex > 0);
        const firstAccrual = nonInitialPoints[0];
        const firstReset = nonInitialPoints.find(
          (point) => point.rateSource !== 'first_year_fixed',
        );

        expect(result.netPayoutValue).toBeGreaterThan(result.initialInvestment);
        expect(result.timeline.at(-1)?.isWithdrawal).toBe(true);
        expect(firstAccrual?.interestRate).toBeCloseTo(definition.firstYearRate, 6);

        if (bondType === BondType.OTS || bondType === BondType.TOS) {
          expect(new Set(nonInitialPoints.map((point) => point.rateSource))).toEqual(
            new Set(['fixed_rate']),
          );
          expect(new Set(nonInitialPoints.map((point) => point.interestRate))).toEqual(
            new Set([definition.firstYearRate]),
          );
          return;
        }

        expect(firstAccrual?.rateSource).toBe('first_year_fixed');

        if (bondType === BondType.ROR || bondType === BondType.DOR) {
          expect(firstReset?.rateSource).toMatch(/nbp/);
          expect(firstReset?.rateMarginApplied).toBeCloseTo(definition.margin, 6);
          return;
        }

        expect(firstReset?.rateSource).toMatch(/cpi/);
        expect(firstReset?.rateMarginApplied).toBeCloseTo(definition.margin, 6);
      },
    );

    it('keeps the EDO tax-wrapper ordering stable', async () => {
      const standard = await getSingleBondResult(BondType.EDO, TaxStrategy.STANDARD);
      const ike = await getSingleBondResult(BondType.EDO, TaxStrategy.IKE);
      const ikze = await getSingleBondResult(BondType.EDO, TaxStrategy.IKZE);

      expect(ike.totalTax).toBe(0);
      expect(standard.totalTax).toBeGreaterThan(0);
      expect(ikze.totalTax).toBeGreaterThan(standard.totalTax);
      expect(ike.netPayoutValue).toBeGreaterThan(standard.netPayoutValue);
      expect(standard.netPayoutValue).toBeGreaterThan(ikze.netPayoutValue);
      expect(ike.maturityDate).toBe(standard.maturityDate);
      expect(ikze.maturityDate).toBe(standard.maturityDate);
    });
  });

  describe('conditional calculator benchmark cases', () => {
    it('keeps the 48-month COI regular-investment scenario internally consistent', async () => {
      const envelope = await calculationService.calculate({
        kind: ScenarioKind.REGULAR_INVESTMENT,
        payload: buildRegularInvestmentPayload(BondType.COI, 48),
      });

      const result = envelope.result as RegularInvestmentResult;

      expect(result.totalInvested).toBe(48000);
      expect(result.finalNominalValue).toBeGreaterThan(48000);
      // COI tax now follows annual issuer coupon periods, not a monthly approximation.
      expect(result.totalTax).toBeGreaterThan(650);
      expect(result.totalTax).toBeLessThan(1200);
      expect(result.totalProfit).toBeGreaterThan(2500);
      expect(result.totalProfit).toBeLessThan(4000);
      expect(result.lots).toHaveLength(48);
    });

    it('keeps the 60-month EDO regular-investment scenario internally consistent', async () => {
      const envelope = await calculationService.calculate({
        kind: ScenarioKind.REGULAR_INVESTMENT,
        payload: buildRegularInvestmentPayload(BondType.EDO, 60),
      });

      const result = envelope.result as RegularInvestmentResult;

      expect(result.totalInvested).toBe(60000);
      expect(result.finalNominalValue).toBeGreaterThan(65000);
      expect(result.finalNominalValue).toBeLessThan(71000);
      expect(result.totalTax).toBeGreaterThan(1000);
      expect(result.totalTax).toBeLessThan(1800);
      expect(result.totalProfit).toBeGreaterThan(4500);
      expect(result.totalProfit).toBeLessThan(7000);
      expect(result.lots).toHaveLength(60);
    });

    it('keeps the normalized 60-month comparison ordering stable', async () => {
      const purchaseDate = toDateString(today);
      const withdrawalDate = getWithdrawalDateFromMonths(purchaseDate, 60);

      const envelope = await calculationService.calculate({
        kind: ScenarioKind.BOND_COMPARISON,
        payload: {
          bondTypes: [BondType.TOS, BondType.COI, BondType.EDO],
          initialInvestment: 10000,
          purchaseDate,
          withdrawalDate,
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          taxStrategy: TaxStrategy.STANDARD,
          reinvest: true,
        },
      });

      const result = envelope.result as BondComparisonScenarioItem[];

      expect(result).toHaveLength(3);
      expect(result.map((item) => item.type)).toEqual([BondType.TOS, BondType.COI, BondType.EDO]);
      expect(result[0].result.netPayoutValue).toBeLessThan(result[1].result.netPayoutValue);
      expect(result[2].result.netPayoutValue).toBeGreaterThan(result[0].result.netPayoutValue);
      expect(result[0].result.nominalAnnualizedReturn).toBeLessThan(
        result[1].result.nominalAnnualizedReturn,
      );
      expect(result[2].result.nominalAnnualizedReturn).toBeGreaterThan(
        result[0].result.nominalAnnualizedReturn,
      );
    });
  });

  describe('limited-model benchmark cases', () => {
    it('keeps the retirement EDO steady-rate benchmark sustainable', async () => {
      const envelope = await calculationService.calculate({
        kind: ScenarioKind.RETIREMENT_PLANNER,
        payload: {
          initialCapital: 500000,
          monthlyWithdrawal: 3000,
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          bondType: BondType.EDO,
          taxStrategy: TaxStrategy.STANDARD,
          horizonYears: 20,
        },
      });

      const result = envelope.result as RetirementPlannerResult;

      expect(result.finalBalance).toBeGreaterThan(50000);
      expect(result.finalBalance).toBeLessThan(100000);
      expect(result.totalWithdrawn).toBe(720000);
      expect(result.totalTaxPaid).toBeGreaterThan(50000);
      expect(result.totalTaxPaid).toBeLessThan(80000);
      expect(result.modeledAnnualRate).toBeGreaterThan(5);
      expect(result.modeledAnnualRate).toBeLessThan(6);
      expect(result.exhaustionDate).toBeUndefined();
      expect(result.isSustainable).toBe(true);
    });
  });
});
