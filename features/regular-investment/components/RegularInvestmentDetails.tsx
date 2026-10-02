'use client';

import dynamic from 'next/dynamic';

import { RegularInvestmentInputs, RegularInvestmentResult } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { ReadingChecklist } from '@/shared/components/insights/ReadingChecklist';
import { CalculatorSection } from '@/shared/components/page/CalculatorSection';
import { CalculationMetaPanel } from '@/shared/components/results/CalculationMetaPanel';
import { SecondaryInsightAccordion } from '@/shared/components/results/SecondaryInsightAccordion';

const RegularInvestmentChart = dynamic(
  () => import('./RegularInvestmentChart').then((module) => module.RegularInvestmentChart),
  {
    loading: () => (
      <div className="h-[320px] w-full animate-pulse rounded-md bg-muted md:h-[420px]" />
    ),
  },
);

interface RegularInvestmentDetailsProps {
  results: RegularInvestmentResult;
  inputs: RegularInvestmentInputs;
  isCalculating: boolean;
  hasPreviousOfferResult: boolean;
  readingGuide: string[];
  warnings: string[];
  assumptions: string[] | undefined;
  envelope:
    import('@/features/bond-core/types/scenarios').RegularInvestmentCalculationEnvelope | null;
}

/** Result-only visualizations and audit detail, loaded after a calculation exists. */
export function RegularInvestmentDetails({
  results,
  inputs,
  isCalculating,
  hasPreviousOfferResult,
  readingGuide,
  warnings,
  assumptions,
  envelope,
}: RegularInvestmentDetailsProps) {
  const { t } = useAppI18n();

  return (
    <div
      className={cn(
        'ui-compact-flow transition-opacity duration-200',
        isCalculating && 'pointer-events-none opacity-50',
      )}
    >
      {hasPreviousOfferResult ? (
        <p className="ui-meta border-l-2 border-amber-500/70 pl-3" role="status">
          Wyniki dotyczą poprzednio zatwierdzonej oferty. Przelicz symulację po zmianie parametrów
          lub oferty obligacji.
        </p>
      ) : null}
      <CalculatorSection
        title={t('regular_investment_page.chart_title')}
        description={t('regular_investment_page.chart_description')}
        className="ui-section-divider"
      >
        <RegularInvestmentChart results={results} bondType={inputs.bondType} />
      </CalculatorSection>

      <SecondaryInsightAccordion
        title={t('regular_investment_page.how_to_read_title')}
        description={t('regular_investment_page.how_to_read_description')}
        badge={t('regular_investment_page.how_to_read_badge')}
      >
        <ReadingChecklist items={readingGuide} />
      </SecondaryInsightAccordion>

      <SecondaryInsightAccordion
        title={t('bonds.simulation.calculation_context')}
        description={t('regular_investment_page.calculation_context_description')}
        badge={t('regular_investment_page.calculation_context_badge')}
      >
        <CalculationMetaPanel
          warnings={warnings}
          assumptions={assumptions}
          calculationNotes={envelope?.calculationNotes}
          dataQualityFlags={envelope?.dataQualityFlags}
          dataFreshness={envelope?.dataFreshness}
        />
      </SecondaryInsightAccordion>
    </div>
  );
}
