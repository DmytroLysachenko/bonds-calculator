import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';
import { getWithdrawalDateFromMonths, toDateString } from '@/shared/lib/date-timing';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import {
  ALL_BOND_TYPES,
  FAMILY_BOND_TYPES,
  getBondSupportMeta,
  isFamilyBondType,
  RETIREMENT_SUPPORTED_BOND_TYPES,
  supportsRetirementBondType,
} from '../support-matrix';
import {
  BondType,
  CalculationResult,
  InvestmentFrequency,
  RegularInvestmentResult,
  TaxStrategy,
} from '../types';
import {
  BondComparisonScenarioItem,
  BondOptimizerResult,
  PortfolioSimulationResult,
  RetirementPlannerResult,
  ScenarioKind,
} from '../types/scenarios';
import { calculationCache } from '../utils/calculation-cache';

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

function buildSingleBondPayload(bondType: BondType) {
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
    taxStrategy: TaxStrategy.STANDARD,
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

describe('Feature support matrix regression suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  describe('trusted core: single bond calculator', () => {
    it.each(ALL_BOND_TYPES)('calculates a stable single-bond scenario for %s', async (bondType) => {
      const envelope = await calculationService.calculate({
        kind: ScenarioKind.SINGLE_BOND,
        payload: buildSingleBondPayload(bondType),
      });

      const result = envelope.result as CalculationResult;

      expect(envelope.dataFreshness.status).toBe('fresh');
      expect(envelope.assumptions.length).toBeGreaterThan(0);
      expect(result.timeline.length).toBeGreaterThan(1);
      expect(result.netPayoutValue).toBeGreaterThan(0);
      expect(result.maturityDate >= buildSingleBondPayload(bondType).purchaseDate).toBe(true);
    });
  });

  describe('conditional flows: comparison, regular investment, notebook simulation', () => {
    it.each([
      { bondType: BondType.ROR, horizonMonths: 24 },
      { bondType: BondType.TOS, horizonMonths: 36 },
      { bondType: BondType.COI, horizonMonths: 48 },
      { bondType: BondType.EDO, horizonMonths: 60 },
    ])(
      'calculates regular investment for $bondType over $horizonMonths months',
      async ({ bondType, horizonMonths }) => {
        const envelope = await calculationService.calculate({
          kind: ScenarioKind.REGULAR_INVESTMENT,
          payload: buildRegularInvestmentPayload(bondType, horizonMonths),
        });

        const result = envelope.result as RegularInvestmentResult;

        expect(result.timeline.length).toBeGreaterThan(1);
        expect(result.lots.length).toBeGreaterThan(0);
        expect(result.totalInvested).toBeGreaterThan(0);
        expect(result.finalNominalValue).toBeGreaterThan(0);
        expect(envelope.diagnostics).toContainEqual({
          code: 'expected_inflation',
          severity: 'assumption',
          params: { value: 3.5 },
        });
      },
    );

    it('calculates normalized comparison for representative core bonds', async () => {
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
      expect(result.every((item) => item.result.netPayoutValue > 0)).toBe(true);
      expect(envelope.diagnostics).toContainEqual({
        code: 'comparison_normalized',
        severity: 'assumption',
      });
    });

    it('calculates descriptive portfolio simulation for stored-lot style payloads', async () => {
      const withdrawalDate = getWithdrawalDateFromMonths(toDateString(today), 120);
      const envelope = await calculationService.calculate({
        kind: ScenarioKind.PORTFOLIO_SIMULATION,
        payload: {
          investments: [
            {
              bondType: BondType.EDO,
              amount: 40,
              purchaseDate: '2025-01-01',
              isRebought: false,
              taxStrategy: TaxStrategy.STANDARD,
              rollover: true,
            },
            {
              bondType: BondType.COI,
              amount: 60,
              purchaseDate: '2025-03-01',
              isRebought: false,
              taxStrategy: TaxStrategy.STANDARD,
              rollover: true,
            },
          ],
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          withdrawalDate,
        },
      });

      const result = envelope.result as PortfolioSimulationResult;

      expect(result.items).toHaveLength(2);
      expect(result.summary.totalInvested).toBeGreaterThan(0);
      expect(result.aggregatedTimeline.length).toBeGreaterThan(0);
      expect(result.summary.totalNetValue).toBeGreaterThanOrEqual(0);
      expect(result.items.every((item) => item.result.netPayoutValue >= 0)).toBe(true);
      expect(envelope.diagnostics).toContainEqual({
        code: 'portfolio_sparse_checkpoints',
        severity: 'assumption',
      });
    });
  });

  describe('experimental and limited flows', () => {
    it('excludes family bonds from optimizer unless explicitly enabled', async () => {
      const purchaseDate = toDateString(today);

      const withoutFamilyEnvelope = await calculationService.calculate({
        kind: ScenarioKind.BOND_OPTIMIZER,
        payload: {
          initialInvestment: 10000,
          purchaseDate,
          investmentHorizonMonths: 60,
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          taxStrategy: TaxStrategy.STANDARD,
          includeFamilyBonds: false,
        },
      });

      const withFamilyEnvelope = await calculationService.calculate({
        kind: ScenarioKind.BOND_OPTIMIZER,
        payload: {
          initialInvestment: 10000,
          purchaseDate,
          investmentHorizonMonths: 60,
          expectedInflation: 3.5,
          expectedNbpRate: 5.25,
          taxStrategy: TaxStrategy.STANDARD,
          includeFamilyBonds: true,
        },
      });

      const withoutFamily = withoutFamilyEnvelope.result as BondOptimizerResult;
      const withFamily = withFamilyEnvelope.result as BondOptimizerResult;

      expect(withoutFamilyEnvelope.assumptions).toContain(
        'Ranking metric: Highest projected net payout after 5.0 years in this scenario.',
      );
      expect(withoutFamilyEnvelope.diagnostics).toContainEqual({
        code: 'ranking_net_payout',
        severity: 'assumption',
        params: { years: '5.0' },
      });

      for (const familyType of FAMILY_BOND_TYPES) {
        expect(withoutFamily.rankedBonds.some((item) => item.bondType === familyType)).toBe(false);
        expect(withFamily.rankedBonds.some((item) => item.bondType === familyType)).toBe(true);
      }
    });

    it.each([
      {
        bondType: BondType.ROR,
        expectedInflation: 3.5,
        expectedNbpRate: 5.25,
        expectedAnnualRate: 5.25,
      },
      {
        bondType: BondType.EDO,
        expectedInflation: 3.5,
        expectedNbpRate: 5.25,
        expectedAnnualRate: 5.5,
      },
      {
        bondType: BondType.TOS,
        expectedInflation: 3.5,
        expectedNbpRate: 5.25,
        expectedAnnualRate: BOND_DEFINITIONS[BondType.TOS].firstYearRate,
      },
    ])(
      'retirement planner exposes honest steady-rate model data for $bondType',
      async ({ bondType, expectedInflation, expectedNbpRate, expectedAnnualRate }) => {
        const envelope = await calculationService.calculate({
          kind: ScenarioKind.RETIREMENT_PLANNER,
          payload: {
            initialCapital: 500000,
            monthlyWithdrawal: 3000,
            expectedInflation,
            expectedNbpRate,
            bondType,
            taxStrategy: TaxStrategy.STANDARD,
            horizonYears: 20,
          },
        });

        const result = envelope.result as RetirementPlannerResult;

        expect(result.modelType).toBe('steady-rate');
        expect(result.modeledBondType).toBe(bondType);
        expect(result.modeledAnnualRate).toBeCloseTo(expectedAnnualRate, 5);
        expect(result.timeline.length).toBeGreaterThan(1);
        expect(result.totalWithdrawn).toBeGreaterThan(0);
        expect(envelope.diagnostics).toContainEqual({
          code: 'retirement_approximation',
          severity: 'assumption',
        });
        expect(result.timeline[0].withdrawal).toBe(0);
        expect(result.timeline[0].balance).toBe(500000);
        expect(result.timeline.reduce((sum, row) => sum + row.withdrawal, 0)).toBeCloseTo(
          result.totalWithdrawn,
          6,
        );
      },
    );

    it('records only the available final withdrawal when the balance is exhausted', async () => {
      const envelope = await calculationService.calculate({
        kind: ScenarioKind.RETIREMENT_PLANNER,
        payload: {
          initialCapital: 100,
          monthlyWithdrawal: 90,
          expectedInflation: 0,
          expectedNbpRate: 0,
          bondType: BondType.ROR,
          taxStrategy: TaxStrategy.STANDARD,
          horizonYears: 1,
          projectionStartDate: '2026-01-01',
        },
      });
      const result = envelope.result as RetirementPlannerResult;
      expect(result.timeline[0]).toMatchObject({ balance: 100, withdrawal: 0 });
      expect(result.timeline.at(-1)?.withdrawal).toBeLessThan(90);
      expect(result.timeline.reduce((sum, row) => sum + row.withdrawal, 0)).toBeCloseTo(
        result.totalWithdrawn,
        6,
      );
      expect(result.exhaustionDate).toBe(result.timeline.at(-1)?.date);
    });

    it('reconciles exact first- and second-month depletion at zero modeled return', async () => {
      for (const withdrawal of [50, 200]) {
        const envelope = await calculationService.calculate({
          kind: ScenarioKind.RETIREMENT_PLANNER,
          payload: {
            initialCapital: 100,
            monthlyWithdrawal: withdrawal,
            expectedInflation: 0,
            expectedNbpRate: 0,
            bondType: BondType.ROR,
            taxStrategy: TaxStrategy.STANDARD,
            horizonYears: 1,
            projectionStartDate: '2026-01-01',
          },
        });
        const result = envelope.result as RetirementPlannerResult;
        const expectedMonth = withdrawal === 50 ? 2 : 1;
        expect(result.modeledAnnualRate).toBe(0);
        expect(result.timeline[0]).toMatchObject({ balance: 100, withdrawal: 0 });
        expect(result.timeline.at(-1)).toMatchObject({
          date: `2026-${String(expectedMonth + 1).padStart(2, '0')}-01`,
          balance: 0,
          withdrawal: withdrawal === 50 ? 50 : 100,
        });
        expect(result.exhaustionDate).toBe(result.timeline.at(-1)?.date);
        expect(result.totalWithdrawn).toBe(100);
        expect(result.totalTaxPaid).toBe(0);
        expect(result.timeline.reduce((sum, row) => sum + row.withdrawal, 0)).toBe(100);
      }
    });

    it('distinguishes standard periodic tax from wrapper assumptions', async () => {
      const run = async (taxStrategy: TaxStrategy) =>
        calculationService.calculate({
          kind: ScenarioKind.RETIREMENT_PLANNER,
          payload: {
            initialCapital: 1000,
            monthlyWithdrawal: 1,
            expectedInflation: 0,
            expectedNbpRate: 12,
            bondType: BondType.ROR,
            taxStrategy,
            horizonYears: 1,
            projectionStartDate: '2026-01-01',
          },
        });
      const standard = (await run(TaxStrategy.STANDARD)).result as RetirementPlannerResult;
      const ike = (await run(TaxStrategy.IKE)).result as RetirementPlannerResult;
      const ikze = (await run(TaxStrategy.IKZE)).result as RetirementPlannerResult;
      expect(standard.totalTaxPaid).toBeGreaterThan(0);
      expect(ike.totalTaxPaid).toBe(0);
      expect(ikze.totalTaxPaid).toBe(0);
      expect(standard.finalBalance).toBeLessThan(ike.finalBalance);
    });
  });

  describe('trusted boundary rules', () => {
    it('keeps retirement support scope explicit in shared configuration', () => {
      expect(RETIREMENT_SUPPORTED_BOND_TYPES).toEqual([
        BondType.ROR,
        BondType.DOR,
        BondType.TOS,
        BondType.COI,
        BondType.EDO,
      ]);
      expect(
        RETIREMENT_SUPPORTED_BOND_TYPES.every((type) => supportsRetirementBondType(type)),
      ).toBe(true);
      expect(supportsRetirementBondType(BondType.OTS)).toBe(false);
      expect(supportsRetirementBondType(BondType.ROS)).toBe(false);
      expect(supportsRetirementBondType(BondType.ROD)).toBe(false);
    });

    it('keeps family bond labeling centralized', () => {
      for (const familyType of FAMILY_BOND_TYPES) {
        expect(isFamilyBondType(familyType)).toBe(true);
        expect(getBondSupportMeta(familyType).shortLabel).toBe('Family-only');
      }

      expect(isFamilyBondType(BondType.EDO)).toBe(false);
      expect(getBondSupportMeta(BondType.EDO).shortLabel).toBe('Standard');
      expect(getBondSupportMeta(BondType.OTS).shortLabel).toBe('Short-term');
    });

    it('keeps tax behavior consistent across wrapper strategies in single-bond service output', async () => {
      const basePayload = buildSingleBondPayload(BondType.EDO);

      const standardEnvelope = await calculationService.calculate({
        kind: ScenarioKind.SINGLE_BOND,
        payload: { ...basePayload, taxStrategy: TaxStrategy.STANDARD },
      });
      const ikeEnvelope = await calculationService.calculate({
        kind: ScenarioKind.SINGLE_BOND,
        payload: { ...basePayload, taxStrategy: TaxStrategy.IKE },
      });
      const ikzeEnvelope = await calculationService.calculate({
        kind: ScenarioKind.SINGLE_BOND,
        payload: { ...basePayload, taxStrategy: TaxStrategy.IKZE },
      });

      const standard = standardEnvelope.result as CalculationResult;
      const ike = ikeEnvelope.result as CalculationResult;
      const ikze = ikzeEnvelope.result as CalculationResult;

      expect(standard.totalTax).toBeGreaterThan(0);
      expect(ike.totalTax).toBe(0);
      expect(ike.netPayoutValue).toBeCloseTo(ike.grossValue, 5);
      expect(ikze.totalTax).toBeGreaterThan(0);
      expect(ike.netPayoutValue).toBeGreaterThan(standard.netPayoutValue);
      expect(ikze.netPayoutValue).toBeLessThanOrEqual(ike.netPayoutValue);
    });
  });
});
