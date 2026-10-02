import { describe, expect, it, vi } from 'vitest';

import { splitComparisonEnvelope } from '@/features/comparison-engine/lib/comparison-calculator-state';
import { translateMessage } from '@/i18n/translate';
import { localizeCalculationDiagnostic } from '@/shared/lib/calculation-evidence';
import { toDateString } from '@/shared/lib/date-timing';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import type { HandlerData } from '../handlers/base';
import { ComparisonHandler } from '../handlers/comparison';
import { BondType, TaxStrategy } from '../types';
import { BondComparisonScenarioRequestSchema } from '../types/schemas';

const selectedSeriesId = '22222222-2222-4222-8222-222222222222';

describe('independent comparison issued-series identity', () => {
  const payload = {
    mode: 'independent' as const,
    sharedConfig: {
      initialInvestment: 1000,
      purchaseDate: '2023-10-01',
      withdrawalDate: '2024-10-01',
      expectedInflation: 3,
      expectedNbpRate: 5,
      taxStrategy: TaxStrategy.STANDARD,
      timingMode: 'exact' as const,
      investmentHorizonMonths: 12,
      strategyPolicy: 'hold_to_maturity' as const,
    },
    scenarioA: { bondType: BondType.ROR, selectedSeriesId },
    scenarioB: { bondType: BondType.DOR },
  };

  it('preserves an exact series ID through validation and offer resolution', async () => {
    const resolveBondOfferTerms = vi.fn<HandlerData['resolveBondOfferTerms']>(async (bondType) => ({
      firstYearRate: bondType === BondType.ROR ? 5 : 5.15,
      margin: bondType === BondType.ROR ? 0 : 0.15,
      source: 'series',
      termsAreVerified: true,
      seriesCode: bondType === BondType.ROR ? 'ROR1024' : 'DOR1025',
    }));
    const data: HandlerData = {
      getHistoricalDataMap: async () => ({}),
      getHistoricalAverages: async () => ({
        inflation: { '1y': 3, '5y': 3, '10y': 3 },
        nbpRate: { '1y': 5, '5y': 5, '10y': 5 },
      }),
      getTaxRulesForYear: async () => null,
      resolveBondOfferTerms,
    };
    const request = BondComparisonScenarioRequestSchema.parse({
      kind: 'bond-comparison',
      payload,
    });
    const result = await new ComparisonHandler(data).handle(request.payload, {
      dataFreshness: { status: 'fresh', usedFallback: false },
      dbDefinitions: BOND_DEFINITIONS,
    });

    expect(result.result).toHaveLength(2);
    expect(result.result[0].offerTerms).toMatchObject({
      source: 'series',
      seriesCode: 'ROR1024',
      termsAreVerified: true,
    });
    expect(splitComparisonEnvelope(result).envelopeA?.offerTerms?.seriesCode).toBe('ROR1024');
    expect(resolveBondOfferTerms).toHaveBeenCalledWith(
      BondType.ROR,
      '2023-10-01',
      BOND_DEFINITIONS,
      selectedSeriesId,
    );
    expect(resolveBondOfferTerms).toHaveBeenCalledWith(
      BondType.DOR,
      '2023-10-01',
      BOND_DEFINITIONS,
      undefined,
    );
  });

  it.each([
    { selectedSeriesId: 'current' },
    { isRebought: true },
    { rollover: true },
    { firstYearRate: 99 },
    { unknownPolicy: 'silently-stripped' },
  ])('rejects malformed or ignored override fields %j', (override) => {
    expect(
      BondComparisonScenarioRequestSchema.safeParse({
        kind: 'bond-comparison',
        payload: { ...payload, scenarioA: { ...payload.scenarioA, ...override } },
      }).success,
    ).toBe(false);
  });

  it('compares the same family under different per-side maturity and coupon policies', async () => {
    const data: HandlerData = {
      getHistoricalDataMap: async () => ({}),
      getHistoricalAverages: async () => ({
        inflation: { '1y': 3, '5y': 3, '10y': 3 },
        nbpRate: { '1y': 5, '5y': 5, '10y': 5 },
      }),
      getTaxRulesForYear: async () => null,
      resolveBondOfferTerms: async () => ({
        firstYearRate: 5,
        margin: 0,
        source: 'definition',
        termsAreVerified: false,
      }),
    };
    const request = BondComparisonScenarioRequestSchema.parse({
      kind: 'bond-comparison',
      payload: {
        ...payload,
        sharedConfig: {
          ...payload.sharedConfig,
          withdrawalDate: '2025-10-01',
          investmentHorizonMonths: 24,
          strategyPolicy: 'reinvest_until_horizon',
        },
        scenarioA: {
          bondType: BondType.ROR,
          strategyPolicy: 'hold_to_maturity',
          couponDisposition: 'cash',
        },
        scenarioB: {
          bondType: BondType.ROR,
          strategyPolicy: 'reinvest_until_horizon',
          couponDisposition: 'reinvest',
        },
      },
    });
    const result = await new ComparisonHandler(data).handle(request.payload, {
      dataFreshness: { status: 'fresh', usedFallback: false },
      dbDefinitions: BOND_DEFINITIONS,
    });

    expect(result.result.map((item) => item.type)).toEqual([BondType.ROR, BondType.ROR]);
    expect(result.result.map((item) => item.strategyPolicy)).toEqual([
      'hold_to_maturity',
      'reinvest_until_horizon',
    ]);
    expect(result.result[1].result.netPayoutValue).toBeGreaterThan(
      result.result[0].result.netPayoutValue,
    );
    expect(result.assumptions).toContain(
      'Scenario A coupon handling: paid coupons are held as zero-rate cash.',
    );
    expect(result.diagnostics).toContainEqual({
      code: 'comparison_side_coupon_cash',
      severity: 'assumption',
      params: { side: 'A' },
    });
    const sideNote = result.diagnostics?.find(
      (diagnostic) => diagnostic.code === 'comparison_side_coupon_cash',
    );
    expect(sideNote).toBeDefined();
    if (sideNote) {
      expect(
        localizeCalculationDiagnostic(sideNote, (key, params) =>
          translateMessage('en', key, params),
        ),
      ).toContain('Scenario A');
      expect(
        localizeCalculationDiagnostic(sideNote, (key, params) =>
          translateMessage('pl', key, params),
        ),
      ).toContain('Scenariusz A');
    }
  });

  it('keeps matured proceeds as zero-rate cash to the chosen horizon only for the cash policy', async () => {
    const data: HandlerData = {
      getHistoricalDataMap: async () => ({}),
      getHistoricalAverages: async () => ({
        inflation: { '1y': 3, '5y': 3, '10y': 3 },
        nbpRate: { '1y': 5, '5y': 5, '10y': 5 },
      }),
      getTaxRulesForYear: async () => null,
      resolveBondOfferTerms: async () => ({
        firstYearRate: 5,
        margin: 0,
        source: 'definition',
        termsAreVerified: false,
      }),
    };
    const request = BondComparisonScenarioRequestSchema.parse({
      kind: 'bond-comparison',
      payload: {
        ...payload,
        sharedConfig: {
          ...payload.sharedConfig,
          withdrawalDate: '2025-10-01',
          investmentHorizonMonths: 24,
          strategyPolicy: 'reinvest_until_horizon',
        },
        scenarioA: { bondType: BondType.ROR, strategyPolicy: 'cash_after_maturity' },
        scenarioB: { bondType: BondType.ROR, strategyPolicy: 'hold_to_maturity' },
      },
    });
    const result = await new ComparisonHandler(data).handle(request.payload, {
      dataFreshness: { status: 'fresh', usedFallback: false },
      dbDefinitions: BOND_DEFINITIONS,
    });
    const cash = result.result[0].result;
    const native = result.result[1].result;

    expect(toDateString(new Date(cash.timeline.at(-1)!.cycleEndDate))).toBe('2025-10-01');
    expect(cash.timeline.at(-1)?.rateSource).toBe('cash_after_maturity');
    expect(toDateString(new Date(native.timeline.at(-1)!.cycleEndDate))).toBe('2024-10-01');
    expect(cash.netPayoutValue).toBeCloseTo(native.netPayoutValue, 8);
    expect(cash.finalRealValue).toBeLessThan(native.finalRealValue);
    expect(cash.nominalAnnualizedReturn).toBeLessThan(native.nominalAnnualizedReturn);
    expect(cash.timeline.filter((point) => point.isWithdrawal)).toHaveLength(1);
    expect(cash.timeline.at(-1)?.interestEarned).toBe(0);
    expect(
      cash.timeline
        .flatMap((point) => point.events ?? [])
        .filter((event) => event.type === 'WITHDRAWAL'),
    ).toHaveLength(1);
  });
});
