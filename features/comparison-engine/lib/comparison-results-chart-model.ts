import { BondInputs, CalculationResult } from '@/features/bond-core/types';
import {
  BondValueChartPoint,
  BondValueChartTooltipGroup,
} from '@/shared/components/charts/BondValueChart';
import { applyChartContextRates } from '@/shared/lib/chart-context-rates';
import { computeNumericDomain, computeRateDomain } from '@/shared/lib/chart-series';

import { ComparisonChartPoint } from './comparison-display';

type Translate = (key: string, values?: Record<string, string | number>) => string;
type FormatCurrency = (value: number) => string;

interface ComparisonValueChartInput {
  chartData: ComparisonChartPoint[];
  inputsA: BondInputs;
  inputsB: BondInputs;
  resultsA: CalculationResult;
  resultsB: CalculationResult;
  scenarioAColor: string;
  scenarioBColor: string;
  t: Translate;
}

export function buildComparisonValueChartData({
  chartData,
  inputsA,
  inputsB,
  resultsA,
  resultsB,
  scenarioAColor,
  scenarioBColor,
  t,
}: ComparisonValueChartInput): BondValueChartPoint[] {
  const mappedPoints = chartData.map((point) => {
    const scenarioGroups: BondValueChartTooltipGroup[] = [
      {
        id: 'scenario-a',
        title: `${inputsA.bondType} (${t('comparison.scenario_a')})`,
        color: scenarioAColor,
        projected: point.isProjected,
        metrics: [
          {
            label: t('common.nominal_value'),
            value: point.nominalA,
            color: scenarioAColor,
          },
          {
            label: t('common.real_value'),
            value: point.realA,
            color: scenarioAColor,
          },
          {
            label: t('common.net_profit'),
            value: point.nominalA - resultsA.initialInvestment,
            color: scenarioAColor,
          },
        ],
      },
      {
        id: 'scenario-b',
        title: `${inputsB.bondType} (${t('comparison.scenario_b')})`,
        color: scenarioBColor,
        projected: point.isProjected,
        metrics: [
          {
            label: t('common.nominal_value'),
            value: point.nominalB,
            color: scenarioBColor,
          },
          {
            label: t('common.real_value'),
            value: point.realB,
            color: scenarioBColor,
          },
          {
            label: t('common.net_profit'),
            value: point.nominalB - resultsB.initialInvestment,
            color: scenarioBColor,
          },
        ],
      },
    ];

    return {
      label: point.label,
      date: point.label,
      dateKey: point.dateKey,
      nominalA: point.nominalA,
      realA: point.realA,
      nominalB: point.nominalB,
      realB: point.realB,
      inflation: point.inflation,
      nbp: point.nbp,
      isProjected: point.isProjected,
      scenarioGroups,
    };
  });

  return applyChartContextRates(mappedPoints, inputsA);
}

export function buildComparisonChartDomains(valueChartData: BondValueChartPoint[]) {
  return {
    leftDomain: computeNumericDomain(
      valueChartData
        .flatMap((point) => [
          Number(point.nominalA),
          Number(point.realA),
          Number(point.nominalB),
          Number(point.realB),
        ])
        .filter((value) => Number.isFinite(value)),
      {
        minFloor: null,
        minPadding: 250,
        paddingRatio: 0.08,
      },
    ),
    rightDomain: computeRateDomain(
      valueChartData
        .flatMap((point) => [point.inflation, point.nbp])
        .filter((value): value is number => typeof value === 'number'),
    ),
  };
}

export function buildComparisonChartSummary(
  valueChartData: BondValueChartPoint[],
  formatCurrency: FormatCurrency,
  t: Translate,
) {
  const firstPoint = valueChartData[0];
  const lastPoint = valueChartData[valueChartData.length - 1];

  if (!firstPoint || !lastPoint) {
    return t('bonds.chart_accessible_summary_empty');
  }

  return t('comparison.bond_chart_accessible_summary', {
    count: valueChartData.length,
    startA: formatCurrency(Number(firstPoint.nominalA)),
    endA: formatCurrency(Number(lastPoint.nominalA)),
    startB: formatCurrency(Number(firstPoint.nominalB)),
    endB: formatCurrency(Number(lastPoint.nominalB)),
  });
}

export function buildComparisonChartSeries(
  inputsA: BondInputs,
  inputsB: BondInputs,
  scenarioAColor: string,
  scenarioBColor: string,
  t: Translate,
) {
  return [
    {
      key: 'nominalA',
      label: `${inputsA.bondType} (A)`,
      color: scenarioAColor,
    },
    {
      key: 'realA',
      label: `${inputsA.bondType} (A) ${t('common.real_value')}`,
      color: scenarioAColor,
      secondary: true,
    },
    {
      key: 'nominalB',
      label: `${inputsB.bondType} (B)`,
      color: scenarioBColor,
    },
    {
      key: 'realB',
      label: `${inputsB.bondType} (B) ${t('common.real_value')}`,
      color: scenarioBColor,
      secondary: true,
    },
  ];
}
