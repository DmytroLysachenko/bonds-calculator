'use client';

import { Target } from 'lucide-react';
import { usePathname } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useAppI18n } from '@/i18n/client';
import { AppToast } from '@/shared/components/feedback/AppToast';
import { RecalculateButton } from '@/shared/components/feedback/RecalculateButton';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { CalculatorWorkspace } from '@/shared/components/page/CalculatorWorkspace';
import { usePortfolioAccess } from '@/shared/hooks/usePortfolioAccess';
import { buildSingleBondReportProvenance } from '@/shared/lib/report-provenance';

import { useBondCalculator } from '../hooks/useBondCalculator';
import {
  applyGuardrailFix,
  getInputGuardrails,
  InputGuardrailIssue,
} from '../lib/input-guardrails';
import { createSingleCalculatorActions } from '../lib/single-calculator-actions';
import { buildSingleCalculatorReadingGuide } from '../lib/single-calculator-container-model';

import { BondCalculatorDetailsPanel, BondCalculatorResultsPanel } from './BondCalculatorPanels';
import { BondInputsForm } from './BondInputsForm';
import { SavedScenarioLibrary } from './SavedScenarioLibrary';
import { ScenarioDraftStatus } from './ScenarioDraftStatus';
import { SharedScenarioNotice } from './SharedScenarioNotice';

interface BondCalculatorContainerProps {
  initialInputs?: import('@/features/bond-core/types').BondInputs;
  initialBondType?: import('@/features/bond-core/types').BondType | null;
  sharedScenarioTitle?: string;
}

const SINGLE_CALCULATOR_FORM_ID = 'single-calculator-inputs';

export const BondCalculatorContainer: React.FC<BondCalculatorContainerProps> = ({
  initialInputs,
  initialBondType = null,
  sharedScenarioTitle,
}) => {
  const pathname = usePathname();
  const shouldSyncBondToUrl = useRef(Boolean(initialBondType));
  const {
    inputs,
    results,
    envelope,
    isCalculating,
    isError,
    calculate,
    updateInput,
    replaceInputs,
    setBondType,
    isDirty,
    availableSeries,
    selectedSeriesId,
    lastCommittedInputs,
    isPersistenceReady,
  } = useBondCalculator(initialInputs, initialBondType);
  const { t, locale: language } = useAppI18n();
  const committedCashPolicy = lastCommittedInputs
    ? buildSingleBondReportProvenance(lastCommittedInputs, envelope).cashPolicy
    : undefined;
  const { canManageWorkspace } = usePortfolioAccess();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const guardrailSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      initialInputs ||
      !isPersistenceReady ||
      !shouldSyncBondToUrl.current ||
      typeof window === 'undefined' ||
      new URLSearchParams(window.location.search).get('bond') === inputs.bondType
    ) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set('bond', inputs.bondType);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  }, [initialInputs, inputs.bondType, isPersistenceReady, pathname]);

  const handleBondTypeChange = (
    type: import('@/features/bond-core/types').BondType,
    horizonChoice: 'preserve' | 'native',
  ) => {
    shouldSyncBondToUrl.current = true;
    setBondType(type, horizonChoice);
  };
  const translate = useMemo(
    () => (key: string, params?: Record<string, string | number>) => t(key, params),
    [t],
  );
  const guardrails = useMemo(() => getInputGuardrails(inputs, translate), [inputs, translate]);
  const blockingGuardrails = useMemo(
    () => guardrails.filter((issue) => issue.severity === 'blocking'),
    [guardrails],
  );

  const readingGuide = useMemo(() => buildSingleCalculatorReadingGuide(t), [t]);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blockingGuardrails.length > 0) {
      guardrailSummaryRef.current?.focus();
      return;
    }
    if (!isCalculating) {
      calculate();
    }
  };

  const actions = useMemo(
    () =>
      createSingleCalculatorActions({
        results,
        envelope,
        lastCommittedInputs,
        selectedSeriesId: lastCommittedInputs?.selectedSeriesId ?? selectedSeriesId,
        language,
        canManageWorkspace,
        t,
        setStatus: (tone, message) => {
          setStatusTone(tone);
          setStatusMessage(message);
        },
      }),
    [canManageWorkspace, envelope, language, lastCommittedInputs, results, selectedSeriesId, t],
  );
  const committedInputs = lastCommittedInputs ?? inputs;

  const handleApplyGuardrailFix = (issue: InputGuardrailIssue) => {
    replaceInputs(applyGuardrailFix(issue, inputs));
  };

  return (
    <CalculatorPageShell
      title={t('nav.single_calculator')}
      description={t('bonds.single_calculator')}
      icon={<Target className="h-8 w-8" />}
      isCalculating={isCalculating}
      isDirty={isDirty}
      isError={isError}
      hasResults={isPersistenceReady && !!results}
      onShare={actions.shareScenario}
      showImplicitShare={false}
    >
      <div className="ui-page-flow">
        {sharedScenarioTitle ? (
          <SharedScenarioNotice
            title={sharedScenarioTitle}
            badge={t('bonds.shared_scenario_badge')}
            snapshotLabel={t('bonds.shared_scenario_snapshot')}
          />
        ) : null}

        <div className="space-y-2">
          <ScenarioDraftStatus inputs={inputs} isDirty={isDirty} onRestore={replaceInputs} />
          <a
            href="#saved-scenarios-title"
            className="ui-focus-ring inline-flex min-h-9 items-center text-sm font-semibold text-foreground underline underline-offset-4"
          >
            {t('bonds.saved_library.title')}
          </a>
        </div>

        <CalculatorWorkspace
          className="gap-8 xl:gap-10"
          controlsClassName="xl:self-start"
          resultsClassName="min-w-0"
          detailsClassName="min-w-0"
          hasResults={isPersistenceReady && !!results}
          isDirty={isDirty}
          isCalculating={isCalculating}
          scenarioSummary={[
            {
              label: t('bonds.bond.type'),
              value: committedInputs.bondType,
              editTargetId: 'single-core-setup',
            },
            {
              label: t('bonds.bond.series'),
              value:
                availableSeries.find((series) => series.id === committedInputs.selectedSeriesId)
                  ?.seriesCode ?? t('bonds.offer.current'),
              editTargetId: 'single-core-setup',
            },
            {
              label: t('bonds.initial_investment'),
              value: `${committedInputs.initialInvestment} PLN`,
              editTargetId: 'single-core-setup',
            },
            {
              label: t('bonds.purchase_date'),
              value: committedInputs.purchaseDate,
              editTargetId: 'single-timing-setup',
            },
            {
              label: t('bonds.withdrawal_date'),
              value: committedInputs.withdrawalDate,
              editTargetId: 'single-timing-setup',
            },
            {
              label: t('bonds.investment_horizon'),
              value: `${committedInputs.investmentHorizonMonths ?? Math.round(committedInputs.duration * 12)} ${t('common.month_compact')}`,
              editTargetId: 'single-timing-setup',
            },
            {
              label: t('bonds.tax_strategy'),
              value: t(
                committedInputs.taxStrategy === 'IKE'
                  ? 'bonds.tax_ike'
                  : committedInputs.taxStrategy === 'IKZE'
                    ? 'bonds.tax_ikze'
                    : 'bonds.tax_standard',
              ),
              editTargetId: 'single-timing-setup',
            },
            {
              label: t('bonds.receipt_cash_policy'),
              value: committedCashPolicy
                ? t(
                    committedCashPolicy === 'rollover'
                      ? 'bonds.receipt_rollover'
                      : 'bonds.receipt_no_rollover',
                  )
                : t('common.not_available'),
              editTargetId: 'single-timing-setup',
            },
          ]}
          controls={
            <BondInputsForm
              formId={SINGLE_CALCULATOR_FORM_ID}
              onSubmit={handleFormSubmit}
              inputs={inputs}
              onUpdate={updateInput}
              onBondTypeChange={handleBondTypeChange}
              availableSeries={availableSeries}
              selectedSeriesId={selectedSeriesId}
              guardrails={guardrails}
              guardrailSummaryRef={guardrailSummaryRef}
              onApplyGuardrailFix={handleApplyGuardrailFix}
              action={
                <RecalculateButton
                  placement="inline-desktop"
                  isDirty={isDirty}
                  hasResults={!!results}
                  loading={isCalculating}
                  disabled={blockingGuardrails.length > 0}
                  formId={SINGLE_CALCULATOR_FORM_ID}
                  onClick={() => calculate()}
                />
              }
            />
          }
          results={
            <BondCalculatorResultsPanel
              results={results}
              inputs={committedInputs}
              envelope={envelope}
              isCalculating={isCalculating}
              isDirty={isDirty}
              blockingGuardrails={blockingGuardrails}
              canManageWorkspace={canManageWorkspace}
              onSaveScenario={actions.saveScenario}
              onAddToNotebook={actions.addToNotebook}
              onExportPDF={actions.exportPdf}
              onPrepareSensitivityDraft={replaceInputs}
            />
          }
          details={
            <BondCalculatorDetailsPanel
              results={results}
              inputs={committedInputs}
              envelope={envelope}
              isCalculating={isCalculating}
              readingGuide={readingGuide}
            />
          }
        />
        <SavedScenarioLibrary isDirty={isDirty} onRestore={replaceInputs} t={t} />
      </div>

      <AppToast
        message={statusMessage}
        tone={statusTone}
        onDismiss={() => setStatusMessage(null)}
      />
    </CalculatorPageShell>
  );
};
