'use client';
import { ListTree, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { CalculatorLoadingState } from '@/shared/components/feedback/CalculatorLoadingState';
import { RecalculateButton } from '@/shared/components/feedback/RecalculateButton';
import { ReadingChecklist } from '@/shared/components/insights/ReadingChecklist';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { CalculatorWorkspace } from '@/shared/components/page/CalculatorWorkspace';
import { CalculationMetaPanel } from '@/shared/components/results/CalculationMetaPanel';
import { SecondaryInsightAccordion } from '@/shared/components/results/SecondaryInsightAccordion';
import { isCalculatorInputEnter } from '@/shared/lib/calculator-keyboard-submit';

import { RegularInvestmentInputsForm } from '../../regular-investment/components/RegularInvestmentInputsForm';
import { RegularInvestmentResultsSummary } from '../../regular-investment/components/RegularInvestmentResultsSummary';
import { useLadder } from '../hooks/useLadder';

const LadderTimeline = dynamic(
  () => import('./LadderTimeline').then((module) => module.LadderTimeline),
  {
    loading: () => <Skeleton className="h-[460px] w-full rounded-md" />,
  },
);
const LadderEmptyState = () => {
  const { t } = useAppI18n();
  return (
    <section className="ui-section-divider ui-control-stack">
      <div className="ui-section-intro">
        <div className="surface-chip">
          <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {t('bonds.simulation.ready')}
        </div>
        <h3 className="ui-section-title">{t('ladder_page.empty_state_title')}</h3>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t('ladder_page.empty_state_description')}
        </p>
      </div>

      <div className="ui-metric-grid md:grid-cols-3">
        <div className="border-t border-border py-5">
          <p className="ui-card-title">{t('ladder_page.empty_cards.plan_title')}</p>
          <p className="ui-body mt-2 text-muted-foreground">
            {t('ladder_page.empty_cards.plan_description')}
          </p>
        </div>
        <div className="border-t border-border py-5">
          <p className="ui-card-title">{t('ladder_page.empty_cards.committed_title')}</p>
          <p className="ui-body mt-2 text-muted-foreground">
            {t('ladder_page.empty_cards.committed_description')}
          </p>
        </div>
        <div className="border-t border-border py-5">
          <p className="ui-card-title">{t('ladder_page.empty_cards.timing_title')}</p>
          <p className="ui-body mt-2 text-muted-foreground">
            {t('ladder_page.empty_cards.timing_description')}
          </p>
        </div>
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        {t('ladder_page.empty_state_footer')}
      </p>
    </section>
  );
};
export const LadderContainer: React.FC = () => {
  const {
    inputs,
    results,
    updateInput,
    setBondType,
    isDirty,
    isCalculating,
    calculate,
    envelope,
    isPersistenceReady,
    hasPreviousOfferResult,
    committedInputs,
  } = useLadder();
  const { t } = useAppI18n();
  const receiptInputs = committedInputs ?? inputs;
  const readingGuide = [
    t('ladder_page.reading_guide.check_peak_month'),
    t('ladder_page.reading_guide.check_clustering'),
  ];
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isCalculatorInputEnter(event) && (isDirty || !results)) {
      calculate();
    }
  };
  return (
    <CalculatorPageShell
      title={t('nav.ladder')}
      description={t('ladder.what_is_desc')}
      icon={<ListTree className="h-8 w-8" />}
      isCalculating={isCalculating}
      isDirty={isDirty}
      hasResults={isPersistenceReady && !!results}
      onKeyDown={handleKeyDown}
    >
      <CalculatorWorkspace
        className="ui-page-flow"
        resultsClassName="min-w-0"
        detailsClassName="min-w-0"
        hasResults={isPersistenceReady && !!results}
        isDirty={isDirty}
        isCalculating={isCalculating}
        scenarioSummary={[
          {
            label: t('bonds.bond.type'),
            value: receiptInputs.bondType,
            editTargetId: 'regular-instrument-setup',
          },
          {
            label: t('bonds.monthly_investment'),
            value: `${receiptInputs.contributionAmount} PLN`,
            editTargetId: 'regular-budget-setup',
          },
          {
            label: t('bonds.frequency.label'),
            value: t(`bonds.frequency.${receiptInputs.frequency.toLowerCase()}`),
            editTargetId: 'regular-budget-setup',
          },
          {
            label: t('bonds.start_date'),
            value: receiptInputs.purchaseDate,
            editTargetId: 'regular-timing-setup',
          },
          {
            label: t('bonds.withdrawal_date'),
            value: receiptInputs.withdrawalDate,
            editTargetId: 'regular-timing-setup',
          },
          {
            label: t('bonds.investment_horizon'),
            value: `${receiptInputs.investmentHorizonMonths} ${t('common.month_compact')}`,
            editTargetId: 'regular-timing-setup',
          },
          {
            label: t('bonds.tax_strategy'),
            value: t(
              receiptInputs.taxStrategy === 'IKE'
                ? 'bonds.tax_ike'
                : receiptInputs.taxStrategy === 'IKZE'
                  ? 'bonds.tax_ikze'
                  : 'bonds.tax_standard',
            ),
            editTargetId: 'regular-budget-setup',
          },
          {
            label: t('bonds.receipt_cash_policy'),
            value: t(
              receiptInputs.rollover
                ? 'bonds.receipt_rollover'
                : 'bonds.receipt_hold_maturity_cash',
            ),
            editTargetId: 'regular-advanced-setup',
          },
        ]}
        controls={
          <RegularInvestmentInputsForm
            inputs={inputs}
            onUpdate={updateInput as (key: string, value: unknown) => void}
            onBondTypeChange={setBondType}
          />
        }
        results={
          <>
            {!results && !isCalculating ? <LadderEmptyState /> : null}
            {isCalculating && !results ? (
              <CalculatorLoadingState metricCount={1} chartClassName="h-[460px]" />
            ) : null}

            {results ? (
              <div
                className={cn(
                  'ui-compact-flow transition-opacity duration-200',
                  isCalculating && 'pointer-events-none opacity-50',
                )}
              >
                {isDirty ? (
                  <div
                    className="ui-status-note ui-status-note-warning text-foreground"
                    role="status"
                  >
                    {t('ladder_page.stale_results')}
                  </div>
                ) : null}
                {hasPreviousOfferResult ? (
                  <div
                    className="ui-status-note ui-status-note-warning text-foreground"
                    role="status"
                  >
                    Oferta w wynikach została zapisana przed ostatnią zmianą. Uruchom ponowne
                    przeliczenie, aby porównać bieżącą ofertę.
                  </div>
                ) : null}

                <RegularInvestmentResultsSummary
                  results={results}
                  inputs={inputs}
                  dataQualityFlags={envelope?.dataQualityFlags}
                />
              </div>
            ) : null}
          </>
        }
        details={
          results ? (
            <div
              className={cn(
                'ui-compact-flow transition-opacity duration-200',
                isCalculating && 'pointer-events-none opacity-50',
              )}
            >
              <SecondaryInsightAccordion
                title={t('ladder_page.how_to_read_title')}
                description={t('ladder_page.how_to_read_description')}
                badge={t('ladder_page.how_to_read_badge')}
              >
                <ReadingChecklist items={readingGuide} />
              </SecondaryInsightAccordion>

              <LadderTimeline results={results} />

              <SecondaryInsightAccordion
                title={t('bonds.simulation.calculation_context')}
                description={t('ladder_page.calculation_context_description')}
                badge={t('ladder_page.calculation_context_badge')}
              >
                <CalculationMetaPanel
                  warnings={envelope?.warnings}
                  assumptions={envelope?.assumptions}
                  calculationNotes={envelope?.calculationNotes}
                  dataQualityFlags={envelope?.dataQualityFlags}
                  dataFreshness={envelope?.dataFreshness}
                />
              </SecondaryInsightAccordion>
            </div>
          ) : null
        }
      />

      <RecalculateButton
        isDirty={isDirty}
        hasResults={!!results}
        loading={isCalculating}
        onClick={() => calculate()}
      />
    </CalculatorPageShell>
  );
};
