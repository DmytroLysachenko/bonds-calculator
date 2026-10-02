import { describe, expect, it } from 'vitest';

import { BondType, TaxStrategy } from '@/features/bond-core/types';
import { RetirementPlannerCalculationEnvelope } from '@/features/bond-core/types/scenarios';

import {
  createRetirementChartData,
  createRetirementModelLimits,
  createRetirementPlannerLabels,
  createRetirementScenarioCoverage,
  createRetirementTaxStrategyLabels,
  getRetirementTaxStrategyLabel,
  getSupportedRetirementBondType,
} from './retirement-planner-model';

function t(key: string, values?: Record<string, string | number>) {
  return values ? `${key}:${JSON.stringify(values)}` : key;
}

const resultEnvelope: RetirementPlannerCalculationEnvelope = {
  result: {
    isSustainable: true,
    finalBalance: 120_000,
    totalWithdrawn: 80_000,
    totalTaxPaid: 1_200,
    modeledAnnualRate: 5.5,
    modeledMonthlyNetRate: 0.44,
    modeledBondType: BondType.EDO,
    modelType: 'steady-rate',
    timeline: Array.from({ length: 25 }, (_, index) => ({
      year: Math.floor(index / 12),
      month: index % 12,
      date: `2024-${String((index % 12) + 1).padStart(2, '0')}`,
      balance: 100_000 - index * 1_000,
      withdrawal: 2_500,
    })),
  },
  assumptions: [],
  warnings: [],
  calculationNotes: [],
  dataQualityFlags: [],
  dataFreshness: { status: 'fresh', usedFallback: false },
  calculationVersion: 'test-model',
};

describe('retirement planner model', () => {
  it('creates yearly chart points from the monthly timeline', () => {
    expect(createRetirementChartData(resultEnvelope)).toEqual([
      { year: 0, date: '2024-01', balance: 100_000, withdrawal: 2_500 },
      { year: 1, date: '2024-01', balance: 88_000, withdrawal: 2_500 },
      { year: 2, date: '2024-01', balance: 76_000, withdrawal: 2_500 },
    ]);
    expect(createRetirementChartData(null)).toEqual([]);
  });

  it('keeps an off-anniversary exhaustion endpoint visible', () => {
    const short = {
      ...resultEnvelope,
      result: { ...resultEnvelope.result, timeline: resultEnvelope.result.timeline.slice(0, 15) },
    };
    expect(createRetirementChartData(short).map((point) => point.date)).toEqual([
      '2024-01',
      '2024-01',
      '2024-03',
    ]);
  });

  it('creates coverage from the final simulated month', () => {
    expect(createRetirementScenarioCoverage(resultEnvelope, 'en')).toBe('2 years');
    expect(createRetirementScenarioCoverage(null, 'en')).toBeNull();
  });

  it('creates translated labels and model limit text', () => {
    expect(createRetirementPlannerLabels(t).pageTitle).toBe('retirement_page.page_title');
    expect(createRetirementModelLimits(t)).toContain(
      'retirement.supported_bonds_limit:{"bondTypes":"ROR, DOR, TOS, COI, EDO"}',
    );

    const taxLabels = createRetirementTaxStrategyLabels(t);
    expect(getRetirementTaxStrategyLabel(taxLabels, TaxStrategy.IKE)).toBe(
      'retirement_page.tax_strategy.ike',
    );
  });

  it('falls unsupported retirement bond types back to EDO', () => {
    expect(getSupportedRetirementBondType(BondType.EDO)).toBe(BondType.EDO);
    expect(getSupportedRetirementBondType(BondType.OTS)).toBe(BondType.EDO);
  });
});
