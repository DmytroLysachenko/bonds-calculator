'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import {
  BondInputs,
  CalculationResult,
  ChartStep,
  SingleBondCalculationEnvelope,
} from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { ChartSupportNote } from '@/shared/components/charts/ChartSupportNote';
import { ReadingChecklist } from '@/shared/components/insights/ReadingChecklist';
import { CalculatorSection } from '@/shared/components/page/CalculatorSection';
import { CalculationMetaPanel } from '@/shared/components/results/CalculationMetaPanel';
import { CashFlowReconciliation } from '@/shared/components/results/CashFlowReconciliation';
import { SecondaryInsightAccordion } from '@/shared/components/results/SecondaryInsightAccordion';

const BondChart = dynamic(() => import('./BondChart').then((module) => module.BondChart), {
  loading: () => (
    <div className="h-[360px] w-full animate-pulse rounded-md bg-muted md:h-[460px]" />
  ),
});
const BondTimeline = dynamic(
  () => import('./timeline/BondTimeline').then((module) => module.BondTimeline),
  {
    loading: () => <div className="h-72 animate-pulse rounded-md bg-muted" />,
  },
);

interface BondCalculatorDetailsContentProps {
  results: CalculationResult;
  inputs: BondInputs;
  envelope: SingleBondCalculationEnvelope | null;
  isCalculating: boolean;
  readingGuide: string[];
}

/** Result-only reporting modules, excluded from the initial calculator route. */
export function BondCalculatorDetailsContent({
  results,
  inputs,
  envelope,
  isCalculating,
  readingGuide,
}: BondCalculatorDetailsContentProps) {
  const { t } = useAppI18n();
  const [displayStep, setDisplayStep] = React.useState<ChartStep>('yearly');

  return (
    <div
      id="bond-details"
      className={cn(
        'ui-compact-flow transition-opacity duration-200',
        isCalculating && 'pointer-events-none opacity-50',
      )}
    >
      <CalculatorSection
        title={t('bonds.evolution')}
        description={t('bonds.simulation.chart_section_desc')}
      >
        <ChartSupportNote
          title={t('bonds.simulation.chart_help_title')}
          description={t('bonds.simulation.chart_help_desc')}
        />
        <BondChart
          results={results}
          initialInvestment={results.initialInvestment}
          inputs={inputs}
          showRealValue={inputs.showRealValue}
          displayStep={displayStep}
          onDisplayStepChange={setDisplayStep}
        />
      </CalculatorSection>

      <SecondaryInsightAccordion
        title={t('bonds.simulation.how_to_read_title')}
        description={t('bonds.simulation.how_to_read_desc')}
        badge={t('bonds.simulation.secondary_badge')}
      >
        <ReadingChecklist items={readingGuide} />
      </SecondaryInsightAccordion>

      <CalculatorSection
        title={t('bonds.timeline')}
        description={t('bonds.simulation.timeline_section_desc')}
        className="ui-section-divider"
      >
        <BondTimeline results={results} chartStep={displayStep} />
      </CalculatorSection>

      <CashFlowReconciliation events={results.timeline.flatMap((point) => point.events ?? [])} />

      <SecondaryInsightAccordion
        title={t('bonds.simulation.calculation_context')}
        description={t('bonds.simulation.meta_desc')}
        badge={t('bonds.simulation.meta_badge')}
      >
        <CalculationMetaPanel
          warnings={envelope?.warnings}
          assumptions={envelope?.assumptions}
          calculationNotes={envelope?.calculationNotes}
          dataQualityFlags={envelope?.dataQualityFlags}
          dataFreshness={envelope?.dataFreshness}
          calculationVersion={envelope?.calculationVersion}
          taxRulesRevision={envelope?.taxRulesRevision}
          offerTerms={envelope?.offerTerms}
          diagnostics={envelope?.diagnostics}
        />
      </SecondaryInsightAccordion>
    </div>
  );
}
