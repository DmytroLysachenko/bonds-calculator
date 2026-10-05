'use client';

import dynamic from 'next/dynamic';

import { BondInputs, CalculationResult, ChartStep } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { Notice } from '@/shared/components/feedback/Notice';

import type { ComparisonChartPoint } from '../lib/comparison-display';

import { comparisonLayout } from './comparison-layout';
import { ComparisonAssumptionsMetaPanel } from './ComparisonContainerPanels';
import { ComparisonVerdict } from './ComparisonVerdict';

const ComparisonResultsPanel = dynamic(
  () => import('./ComparisonResultsPanel').then((module) => module.ComparisonResultsPanel),
  { loading: () => <div className="h-[360px] animate-pulse rounded-md bg-muted md:h-[460px]" /> },
);
const ComparisonTable = dynamic(
  () => import('./ComparisonTable').then((module) => module.ComparisonTable),
  { loading: () => <div className="h-72 animate-pulse rounded-md bg-muted" /> },
);

interface ComparisonCommittedResultsProps {
  chartData: ComparisonChartPoint[];
  chartStep: ChartStep;
  envelopeA: import('@/features/bond-core/types/scenarios').SingleBondCalculationEnvelope | null;
  envelopeB: import('@/features/bond-core/types/scenarios').SingleBondCalculationEnvelope | null;
  formatCurrency: (value: number) => string;
  hasMounted: boolean;
  inputsA: BondInputs;
  inputsB: BondInputs;
  isCalculating: boolean;
  isDirty: boolean;
  language: 'pl' | 'en';
  onChartStepChange: (step: ChartStep) => void;
  resultsA: CalculationResult;
  resultsB: CalculationResult;
  scenarioAColor: string;
  scenarioBColor: string;
  staleResultsLabel: string;
  usesMixedTimelineCadence: boolean;
  warningsA: string[];
  warningsB: string[];
}

/** Owns presentation of a committed comparison, independent of draft controls. */
export function ComparisonCommittedResults({
  chartData,
  chartStep,
  envelopeA,
  envelopeB,
  formatCurrency,
  hasMounted,
  inputsA,
  inputsB,
  isCalculating,
  isDirty,
  language,
  onChartStepChange,
  resultsA,
  resultsB,
  scenarioAColor,
  scenarioBColor,
  staleResultsLabel,
  usesMixedTimelineCadence,
  warningsA,
  warningsB,
}: ComparisonCommittedResultsProps) {
  const { t } = useAppI18n();
  return (
    <div
      className={`${comparisonLayout.results} ${isCalculating ? 'pointer-events-none opacity-60' : ''}`}
    >
      {isDirty ? (
        <Notice tone="warning" compact>
          {staleResultsLabel}
        </Notice>
      ) : null}
      <ComparisonVerdict
        resultsA={resultsA}
        resultsB={resultsB}
        inputsA={inputsA}
        inputsB={inputsB}
        expectedInflation={inputsA.expectedInflation}
        taxStrategy={inputsA.taxStrategy}
        formatCurrency={formatCurrency}
      />
      <p className="border-l-2 border-border pl-3 text-base leading-7 text-muted-foreground">
        {t('comparison.result_fairness_caveat')}
      </p>
      <ComparisonAssumptionsMetaPanel
        envelopeA={envelopeA}
        envelopeB={envelopeB}
        warningsA={warningsA}
        warningsB={warningsB}
        inputsA={inputsA}
        inputsB={inputsB}
      />
      {hasMounted ? (
        <ComparisonResultsPanel
          chartData={chartData}
          usesMixedTimelineCadence={usesMixedTimelineCadence}
          resultsA={resultsA}
          resultsB={resultsB}
          inputsA={inputsA}
          inputsB={inputsB}
          formatCurrency={formatCurrency}
          language={language}
          chartStep={chartStep}
          onChartStepChange={onChartStepChange}
          scenarioAColor={scenarioAColor}
          scenarioBColor={scenarioBColor}
        />
      ) : null}
      <ComparisonTable
        resultsA={resultsA}
        resultsB={resultsB}
        purchaseDate={inputsA.purchaseDate}
        bondTypeA={inputsA.bondType}
        bondTypeB={inputsB.bondType}
        formatCurrency={formatCurrency}
        chartStep={chartStep}
      />
    </div>
  );
}
