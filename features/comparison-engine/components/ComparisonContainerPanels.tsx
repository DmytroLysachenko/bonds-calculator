'use client';

import { Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BondInputs, SingleBondCalculationEnvelope } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { Notice } from '@/shared/components/feedback/Notice';
import { ScenarioReadyPanel } from '@/shared/components/feedback/ScenarioReadyPanel';
import { CalculationMetaPanel } from '@/shared/components/results/CalculationMetaPanel';
import { SecondaryInsightAccordion } from '@/shared/components/results/SecondaryInsightAccordion';

import type { ComparisonOfferStatus } from '../lib/comparison-offer-status';

interface ComparisonFairnessPanelProps {
  durationMismatchTitle: string;
  durationMismatchText: string | null;
  hasResults: boolean;
  isCalculating: boolean;
  onCalculate: () => void;
}

interface ComparisonSetupStatePanelProps {
  hasResults: boolean;
  isCalculating: boolean;
}

interface ComparisonAssumptionsMetaPanelProps {
  envelopeA: SingleBondCalculationEnvelope | null;
  envelopeB: SingleBondCalculationEnvelope | null;
  warningsA: string[];
  warningsB: string[];
  inputsA: BondInputs;
  inputsB: BondInputs;
  offerStatusA?: ComparisonOfferStatus;
  offerStatusB?: ComparisonOfferStatus;
}

export function ComparisonFairnessPanel({
  durationMismatchTitle,
  durationMismatchText,
  hasResults,
  isCalculating,
  onCalculate,
}: ComparisonFairnessPanelProps) {
  const { t } = useAppI18n();

  return (
    <section className="ui-plan-region ui-control-stack px-5 py-5 md:px-6 md:py-6">
      <div className="ui-section-header gap-4">
        <div className="ui-section-intro">
          <h2 className="ui-card-title">{t('comparison.fairness.title')}</h2>
          <p className="ui-body text-muted-foreground">
            {t('comparison.auto_rollover_fairness_desc')}
          </p>
        </div>
        <div className="ui-status-note shrink-0 text-muted-foreground">
          {t('comparison.fairness.mode_label')}: {t('comparison.auto_rollover_mode_label')}
        </div>
      </div>
      {durationMismatchText ? (
        <Notice tone="info" title={durationMismatchTitle}>
          {durationMismatchText}
        </Notice>
      ) : null}
      {!hasResults ? (
        <Button
          type="button"
          className="h-12 w-full gap-2 text-sm font-semibold md:w-auto"
          onClick={onCalculate}
          disabled={isCalculating}
        >
          {isCalculating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )}
          {t('common.calculate')}
        </Button>
      ) : null}
    </section>
  );
}

export function ComparisonSetupStatePanel({
  hasResults,
  isCalculating,
}: ComparisonSetupStatePanelProps) {
  const { t } = useAppI18n();

  return (
    <>
      {!hasResults && !isCalculating ? (
        <ScenarioReadyPanel
          badge={t('comparison.ready_to_compare')}
          title={t('comparison.ready_title')}
          description={t('comparison.ready_desc')}
          steps={[
            {
              id: 'shared-base',
              title: t('comparison.ready_shared_base'),
              description: t('comparison.ready_shared_base_desc'),
            },
            {
              id: 'scenario-overrides',
              title: t('comparison.ready_overrides'),
              description: t('comparison.ready_overrides_desc'),
            },
            {
              id: 'committed-result',
              title: t('comparison.ready_committed'),
              description: t('comparison.ready_committed_desc'),
            },
          ]}
          footerText={t('comparison.ready_footer')}
        />
      ) : null}

      {isCalculating && !hasResults ? (
        <div className="ui-control-stack" aria-hidden="true">
          <div className="ui-surface-flush space-y-4 p-5 md:p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
          <Skeleton className="h-[260px] w-full rounded-md md:h-[340px]" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Skeleton className="h-[180px] rounded-md md:h-[220px]" />
            <Skeleton className="h-[180px] rounded-md md:h-[220px]" />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ComparisonAssumptionsMetaPanel({
  envelopeA,
  envelopeB,
  warningsA,
  warningsB,
  inputsA,
  inputsB,
  offerStatusA,
  offerStatusB,
}: ComparisonAssumptionsMetaPanelProps) {
  const { t } = useAppI18n();
  const entries = [
    {
      label: `${t('comparison.scenario_a')} (${inputsA.bondType})`,
      envelope: envelopeA,
      warnings: warningsA,
      offerStatus: offerStatusA,
    },
    {
      label: `${t('comparison.scenario_b')} (${inputsB.bondType})`,
      envelope: envelopeB,
      warnings: warningsB,
      offerStatus: offerStatusB,
    },
  ];

  return (
    <SecondaryInsightAccordion
      title={t('comparison.assumptions_meta')}
      description={t('comparison.assumptions_meta_desc')}
      badge={t('comparison.helper_secondary')}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {entries.map((entry) => (
          <section key={entry.label} className="ui-control-stack border-t border-border py-5">
            <h3 className="ui-card-title">
              {entry.label} {t('comparison.notes_suffix')}
            </h3>
            {entry.offerStatus?.message ? (
              <p className="ui-meta text-muted-foreground" role="status">
                {entry.offerStatus.message}
              </p>
            ) : null}
            <CalculationMetaPanel
              warnings={entry.warnings}
              assumptions={entry.envelope?.assumptions}
              calculationNotes={entry.envelope?.calculationNotes}
              dataQualityFlags={entry.envelope?.dataQualityFlags}
              dataFreshness={entry.envelope?.dataFreshness}
              calculationVersion={entry.envelope?.calculationVersion}
              taxRulesRevision={entry.envelope?.taxRulesRevision}
              diagnostics={entry.envelope?.diagnostics}
              offerTerms={entry.envelope?.offerTerms}
              compact
            />
          </section>
        ))}
      </div>
    </SecondaryInsightAccordion>
  );
}
