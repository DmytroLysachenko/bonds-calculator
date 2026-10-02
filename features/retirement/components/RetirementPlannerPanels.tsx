'use client';

import { Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';

import { RetirementPlannerCalculationEnvelope } from '@/features/bond-core/types/scenarios';
import { formatRetirementRate } from '@/features/retirement/lib/retirement-format';
import { RetirementInputs } from '@/features/retirement/types/retirement';
import { ScenarioReadyPanel } from '@/shared/components/feedback/ScenarioReadyPanel';
import { SecondaryInsightAccordion } from '@/shared/components/results/SecondaryInsightAccordion';
import { formatHorizonMonths } from '@/shared/lib/format-horizon';

import { RetirementMonthlyTable } from './RetirementMonthlyTable';
import { RetirementSection, RetirementSummaryMetric } from './RetirementSummarySections';
import { RetirementSupportList } from './RetirementSupportList';

const RetirementResultsOverview = dynamic(
  () => import('./RetirementResultsOverview').then((module) => module.RetirementResultsOverview),
  {
    loading: () => (
      <div className="h-[440px] w-full animate-pulse rounded-lg bg-muted" role="status" />
    ),
  },
);

type RetirementLabels = Record<string, string>;
type RetirementChartDataPoint = {
  year: number;
  date: string;
  balance: number;
  withdrawal: number;
};

interface RetirementResultsPanelProps {
  results: RetirementPlannerCalculationEnvelope;
  isDirty: boolean;
  labels: RetirementLabels;
  chartData: RetirementChartDataPoint[];
  scenarioCoverage: string | null;
  language: 'pl' | 'en';
  inputsHorizonYears: number;
  assumptions: string[];
  taxStrategyLabel: string;
  formatCurrency: (value: number) => string;
}

export function RetirementResultsPanel({
  results,
  isDirty,
  labels,
  chartData,
  scenarioCoverage,
  language,
  inputsHorizonYears,
  assumptions,
  taxStrategyLabel,
  formatCurrency,
}: RetirementResultsPanelProps) {
  return (
    <>
      {isDirty ? (
        <div className="ui-inline-notice border-l-2 border-warning text-foreground">
          {labels.staleResults}
        </div>
      ) : null}

      <div className="grid gap-0 rounded-lg bg-card md:grid-cols-2 xl:grid-cols-4">
        <RetirementSummaryMetric
          label={labels.scenarioStatus}
          value={results.result.isSustainable ? labels.balancePositive : labels.balanceDepletes}
          detail={
            results.result.exhaustionDate
              ? `${labels.projectedExhaustion}: ${results.result.exhaustionDate}`
              : labels.noProjectedDepletion
          }
          tone={results.result.isSustainable ? 'success' : 'warning'}
        />
        <RetirementSummaryMetric
          label={labels.finalBalance}
          value={formatCurrency(results.result.finalBalance)}
          detail={labels.finalBalanceDetail}
        />
        <RetirementSummaryMetric
          label={labels.totalWithdrawn}
          value={formatCurrency(results.result.totalWithdrawn)}
          detail={labels.totalWithdrawnDetail}
        />
        <RetirementSummaryMetric
          label={labels.modeledAnnualRate}
          value={formatRetirementRate(results.result.modeledAnnualRate)}
          detail={labels.modeledAnnualRateDetail.replace(
            '{{bond}}',
            results.result.modeledBondType,
          )}
        />
      </div>

      <RetirementResultsOverview
        chartData={chartData}
        scenarioCoverage={scenarioCoverage}
        labels={labels}
        language={language}
        inputsHorizonYears={inputsHorizonYears}
        taxStrategyLabel={taxStrategyLabel}
        totalTaxPaid={results.result.totalTaxPaid}
        formatCurrency={formatCurrency}
      />

      <RetirementMonthlyTable
        timeline={results.result.timeline}
        title={labels.monthlyTable}
        description={labels.monthlyTableDesc}
        dateLabel={labels.date}
        balanceLabel={labels.balance}
        withdrawalLabel={labels.withdrawal}
        formatCurrency={formatCurrency}
      />

      <SecondaryInsightAccordion
        title={labels.assumptionsAndWarnings}
        description={labels.assumptionsAndWarningsDesc}
        badge={labels.audit}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <RetirementSupportList
            title={labels.assumptions}
            items={assumptions}
            emptyLabel={labels.noExtraAssumptions}
          />
          <RetirementSupportList
            title={labels.warningsAndNotes}
            items={[...results.warnings, ...results.calculationNotes, ...results.dataQualityFlags]}
            emptyLabel={labels.noExtraWarnings}
          />
        </div>
      </SecondaryInsightAccordion>
    </>
  );
}

interface RetirementReadyStatePanelProps {
  inputs: RetirementInputs;
  labels: RetirementLabels;
  language: 'pl' | 'en';
  formatCurrency: (value: number) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function RetirementReadyStatePanel({
  inputs,
  labels,
  language,
  formatCurrency,
  t,
}: RetirementReadyStatePanelProps) {
  return (
    <ScenarioReadyPanel
      badge={labels.readyBadge}
      title={labels.readyTitle}
      description={labels.readyDesc}
      steps={[
        {
          id: 'balance-path',
          title: labels.readyStepBalance,
          description: t('retirement.ready_step_balance_desc', {
            initialCapital: formatCurrency(inputs.initialCapital),
          }),
        },
        {
          id: 'horizon',
          title: labels.readyStepHorizon,
          description: t('retirement.ready_step_horizon_desc', {
            horizon: formatHorizonMonths(inputs.horizonYears * 12, language),
          }),
        },
        {
          id: 'narrow-read',
          title: labels.readyStepRead,
          description: labels.readyStepReadDesc,
        },
      ]}
      footerText={labels.readyFooter}
    />
  );
}

export function RetirementLimitsPanel({
  labels,
  modelLimits,
}: {
  labels: RetirementLabels;
  modelLimits: string[];
}) {
  return (
    <RetirementSection title={labels.limitsTitle} description={labels.limitsDesc}>
      <div className="divide-y divide-dashed divide-border">
        {modelLimits.map((item) => (
          <div key={item} className="px-4 py-3 text-sm leading-6 text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </RetirementSection>
  );
}

export function RetirementDepletionWarning({
  exhaustionDate,
  labels,
}: {
  exhaustionDate?: string;
  labels: RetirementLabels;
}) {
  if (!exhaustionDate) {
    return null;
  }

  return (
    <div className="ui-inline-notice flex items-start gap-3 border-l-2 border-warning text-foreground">
      <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <p>{labels.depletionWarning.replace('{{date}}', exhaustionDate)}</p>
    </div>
  );
}
