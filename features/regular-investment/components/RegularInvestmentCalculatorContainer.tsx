'use client';
import { PiggyBank } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useMemo, useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { CalculatorLoadingState } from '@/shared/components/feedback/CalculatorLoadingState';
import { RecalculateButton } from '@/shared/components/feedback/RecalculateButton';
import { ScenarioReadyPanel } from '@/shared/components/feedback/ScenarioReadyPanel';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { CalculatorWorkspace } from '@/shared/components/page/CalculatorWorkspace';
import { isCalculatorInputEnter } from '@/shared/lib/calculator-keyboard-submit';

import { useRegularInvestmentCalculator } from '../hooks/useRegularInvestmentCalculator';
import { getRegularInvestmentGuardrails } from '../lib/regular-investment-guardrails';

import { RecurringGoalPlanner } from './RecurringGoalPlanner';
import { RegularInvestmentInputsForm } from './RegularInvestmentInputsForm';
const RegularInvestmentResultsSummary = dynamic(
  () =>
    import('./RegularInvestmentResultsSummary').then(
      (module) => module.RegularInvestmentResultsSummary,
    ),
  { loading: () => <Skeleton className="h-72 w-full rounded-md" /> },
);

const RegularInvestmentDetails = dynamic(
  () => import('./RegularInvestmentDetails').then((module) => module.RegularInvestmentDetails),
  { loading: () => <Skeleton className="h-[320px] w-full rounded-md md:h-[420px]" /> },
);
export const RegularInvestmentCalculatorContainer: React.FC = () => {
  const {
    inputs,
    results,
    warnings,
    assumptions,
    isCalculating,
    calculate,
    updateInput,
    setBondType,
    isDirty,
    envelope,
    isPersistenceReady,
    hasPreviousOfferResult,
    committedInputs,
  } = useRegularInvestmentCalculator();
  const { t } = useAppI18n();
  const receiptInputs = committedInputs ?? inputs;
  const guardrailSummaryRef = useRef<HTMLDivElement>(null);
  const guardrails = useMemo(() => getRegularInvestmentGuardrails(inputs), [inputs]);
  const hasBlockingGuardrails = guardrails.some((issue) => issue.severity === 'blocking');
  const readingGuide = [
    t('regular_investment_page.reading_guide.follow_contribution'),
    t('regular_investment_page.reading_guide.compare_lot_age'),
    t('regular_investment_page.reading_guide.check_real_value'),
  ];
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isCalculatorInputEnter(event) && (isDirty || !results)) {
      if (hasBlockingGuardrails) {
        guardrailSummaryRef.current?.focus();
        return;
      }
      calculate();
    }
  };
  return (
    <CalculatorPageShell
      title={t('nav.regular_investment')}
      description={t('bonds.regular_calculator')}
      icon={<PiggyBank className="h-8 w-8" />}
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
            onUpdate={updateInput}
            onBondTypeChange={setBondType}
            guardrails={guardrails}
            guardrailSummaryRef={guardrailSummaryRef}
          />
        }
        results={
          <>
            {!results && !isCalculating ? (
              <ScenarioReadyPanel
                badge={t('bonds.simulation.ready')}
                title={t('bonds.regular_simulation.ready_title')}
                description={t('bonds.regular_simulation.ready_desc')}
                steps={[
                  {
                    id: 'plan',
                    title: t('bonds.regular_simulation.ready_steps.plan.title'),
                    description: t('bonds.regular_simulation.ready_steps.plan.desc'),
                  },
                  {
                    id: 'timing',
                    title: t('bonds.regular_simulation.ready_steps.timing.title'),
                    description: t('bonds.regular_simulation.ready_steps.timing.desc'),
                  },
                  {
                    id: 'advanced',
                    title: t('bonds.regular_simulation.ready_steps.advanced.title'),
                    description: t('bonds.regular_simulation.ready_steps.advanced.desc'),
                  },
                ]}
                footerText={t('bonds.simulation.results_stable')}
              />
            ) : null}

            {isCalculating && !results ? (
              <CalculatorLoadingState chartClassName="h-[320px] md:h-[420px]" />
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
                    {t('bonds.simulation.stale_results')}{' '}
                    <span className="font-semibold">{t('common.recalculate')}</span>.
                  </div>
                ) : null}

                <RegularInvestmentResultsSummary
                  results={results}
                  inputs={inputs}
                  dataQualityFlags={envelope?.dataQualityFlags}
                />
                <RecurringGoalPlanner
                  inputs={inputs}
                  onApply={(value) => updateInput('contributionAmount', value)}
                />
              </div>
            ) : null}
          </>
        }
        details={
          results ? (
            <RegularInvestmentDetails
              results={results}
              inputs={inputs}
              isCalculating={isCalculating}
              hasPreviousOfferResult={hasPreviousOfferResult}
              readingGuide={readingGuide}
              warnings={warnings}
              assumptions={assumptions}
              envelope={envelope}
            />
          ) : null
        }
      />

      <RecalculateButton
        isDirty={isDirty}
        hasResults={!!results}
        loading={isCalculating}
        disabled={hasBlockingGuardrails}
        onClick={() => {
          if (hasBlockingGuardrails) {
            guardrailSummaryRef.current?.focus();
            return;
          }
          calculate();
        }}
      />
    </CalculatorPageShell>
  );
};
