'use client';
import { Download, Scale, Upload } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChartStep } from '@/features/bond-core/types';
import { bondQuantityFromInvestment } from '@/features/bond-core/utils/bond-quantity';
import { useAppI18n } from '@/i18n/client';
import { RecalculateButton } from '@/shared/components/feedback/RecalculateButton';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { useHasMounted } from '@/shared/hooks/useHasMounted';
import { useCurrencyFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { isCalculatorInputEnter } from '@/shared/lib/calculator-keyboard-submit';
import { downloadJsonFile } from '@/shared/lib/csv-utils';
import { formatHorizonMonths } from '@/shared/lib/format-horizon';
import {
  createComparisonScenarioPackage,
  isComparisonPortableScenario,
  parseScenarioPackage,
  serializeScenarioPackage,
} from '@/shared/lib/scenario-codec';

import { useComparison } from '../hooks/useComparison';
import { useComparisonPlanVisibility } from '../hooks/useComparisonPlanVisibility';
import { useComparisonUrlState } from '../hooks/useComparisonUrlState';
import { buildDefaultSharedConfig } from '../lib/comparison-calculator-state';
import { buildComparisonContainerViewModel } from '../lib/comparison-container-model';
import { parseComparisonUrlState } from '../lib/comparison-deep-link';

import { ComparisonPlanReceipt } from './ComparisonPlanReceipt';
import { ComparisonPlanWorkspace } from './ComparisonPlanWorkspace';

const ComparisonCommittedResults = dynamic(
  () => import('./ComparisonCommittedResults').then((module) => module.ComparisonCommittedResults),
  { loading: () => <div className="h-[520px] animate-pulse rounded-md bg-muted" /> },
);

export const ComparisonContainer: React.FC = () => {
  const searchParams = useSearchParams();
  const initialUrlState = useMemo(
    () => parseComparisonUrlState(searchParams, buildDefaultSharedConfig()),
    [searchParams],
  );
  const {
    sharedConfig,
    scenarioA,
    scenarioB,
    inputsA,
    inputsB,
    committedInputsA,
    committedInputsB,
    committedComparisonDraft,
    resultsA,
    resultsB,
    envelopeA,
    envelopeB,
    warningsA,
    warningsB,
    isCalculating,
    calculate,
    restorePortableScenario,
    updateSharedConfig,
    updateScenarioA,
    updateScenarioB,
    setBondTypeA,
    setBondTypeB,
    setScenarioACustomHorizonEnabled,
    setScenarioBCustomHorizonEnabled,
    setScenarioACustomHorizonMonths,
    setScenarioBCustomHorizonMonths,
    isDirty,
    isPersistenceReady,
    definitions,
  } = useComparison(initialUrlState);
  const { t, locale: language } = useAppI18n();
  const [chartStep, setChartStep] = useState<ChartStep>('yearly');
  const [pendingImport, setPendingImport] = useState<{
    sharedConfig: typeof sharedConfig;
    scenarioA: typeof scenarioA;
    scenarioB: typeof scenarioB;
  } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const receiptEditRef = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const focusAfterPlanChange = useRef<'plan' | 'receipt' | null>(null);
  const planEditTarget = useRef<string | null>(null);
  const previousIsCalculating = useRef(isCalculating);
  const hasComparisonResults = isPersistenceReady && !!resultsA && !!resultsB;
  const { isPlanOpen, setIsPlanOpen } = useComparisonPlanVisibility(hasComparisonResults, isDirty);
  const handlePlanOpenChange = (open: boolean, editTargetId?: string) => {
    focusAfterPlanChange.current = open ? 'plan' : 'receipt';
    planEditTarget.current = open ? (editTargetId ?? null) : null;
    setIsPlanOpen(open);
  };

  useEffect(() => {
    if (focusAfterPlanChange.current === 'plan' && isPlanOpen) {
      (planEditTarget.current
        ? planRef.current?.querySelector<HTMLElement>(`#${planEditTarget.current}`)
        : planRef.current?.querySelector<HTMLElement>('[data-comparison-plan]')
      )
        ?.querySelector<HTMLElement>('input, select, textarea, button')
        ?.focus();
      planEditTarget.current = null;
      focusAfterPlanChange.current = null;
    } else if (focusAfterPlanChange.current === 'receipt' && hasComparisonResults && !isPlanOpen) {
      receiptEditRef.current?.focus();
      focusAfterPlanChange.current = null;
    }
  }, [hasComparisonResults, isPlanOpen]);

  useEffect(() => {
    if (previousIsCalculating.current && !isCalculating && hasComparisonResults && !isDirty) {
      if (planRef.current?.contains(document.activeElement)) {
        focusAfterPlanChange.current = 'receipt';
      } else if (document.activeElement === document.body) {
        resultsRef.current?.focus();
      }
    }
    previousIsCalculating.current = isCalculating;
  }, [hasComparisonResults, isCalculating, isDirty]);
  const { onBondTypeChange, onCustomHorizonChange, onScenarioChange, onSharedConfigChange } =
    useComparisonUrlState({
      sharedConfig,
      scenarioA,
      scenarioB,
      updateSharedConfig,
      updateScenario: (scenario, key, value) => {
        if (scenario === 'A') updateScenarioA(key, value);
        else updateScenarioB(key, value);
      },
      updateBondType: (scenario, bondType) => {
        if (scenario === 'A') setBondTypeA(bondType);
        else setBondTypeB(bondType);
      },
      updateCustomHorizon: (scenario, value, enabled) => {
        if (scenario === 'A') {
          if (enabled === undefined) setScenarioACustomHorizonMonths(value);
          else setScenarioACustomHorizonEnabled(enabled);
        } else if (enabled === undefined) setScenarioBCustomHorizonMonths(value);
        else setScenarioBCustomHorizonEnabled(enabled);
      },
    });
  const hasMounted = useHasMounted();
  const currencyFormatter = useCurrencyFormatter(language, {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isCalculatorInputEnter(event) && (isDirty || !resultsA)) {
      calculate();
    }
  };
  const formatCurrency = React.useMemo(
    () => (value: number) => {
      if (!hasMounted) return '---';
      return currencyFormatter.format(value);
    },
    [currencyFormatter, hasMounted],
  );
  const {
    resultInputsA,
    resultInputsB,
    chartData,
    hasMixedTimelineCadence,
    assumptionsBondType,
    durationMismatch,
    scenarioAColor,
    scenarioBColor,
  } = useMemo(
    () =>
      buildComparisonContainerViewModel({
        inputsA,
        inputsB,
        committedInputsA,
        committedInputsB,
        resultsA,
        resultsB,
        scenarioABondType: scenarioA.bondType,
        scenarioBBondType: scenarioB.bondType,
        definitions,
        language,
        t,
        chartStep,
      }),
    [
      chartStep,
      committedInputsA,
      committedInputsB,
      definitions,
      inputsA,
      inputsB,
      language,
      resultsA,
      resultsB,
      scenarioA.bondType,
      scenarioB.bondType,
      t,
    ],
  );
  const durationMismatchText = durationMismatch ? t('comparison.auto_rollover_notice') : null;
  const receiptSharedConfig = committedComparisonDraft?.sharedConfig ?? sharedConfig;
  const receiptScenarioA = committedComparisonDraft?.scenarioA ?? scenarioA;
  const receiptScenarioB = committedComparisonDraft?.scenarioB ?? scenarioB;

  const planSummary = [
    {
      label: t('bonds.bond_quantity'),
      value: `${bondQuantityFromInvestment(receiptSharedConfig.initialInvestment)} ${t('bonds.units')}`,
      editTargetId: 'comparison-shared-setup',
    },
    {
      label: t('bonds.investment_horizon'),
      value: formatHorizonMonths(receiptSharedConfig.investmentHorizonMonths ?? 120, language),
      editTargetId: 'comparison-shared-setup',
    },
    {
      label: t('bonds.purchase_date'),
      value: receiptSharedConfig.purchaseDate,
      editTargetId: 'comparison-shared-setup',
    },
    {
      label: t('bonds.withdrawal_date'),
      value: receiptSharedConfig.withdrawalDate,
      editTargetId: 'comparison-shared-setup',
    },
    {
      label: t('bonds.tax_strategy'),
      value: t(
        receiptSharedConfig.taxStrategy === 'IKE'
          ? 'bonds.tax_ike'
          : receiptSharedConfig.taxStrategy === 'IKZE'
            ? 'bonds.tax_ikze'
            : 'bonds.tax_standard',
      ),
      editTargetId: 'comparison-shared-setup',
    },
    {
      label: t('comparison.scenario_a'),
      value: receiptScenarioA.bondType,
      editTargetId: 'comparison-scenarios-setup',
    },
    {
      label: t('comparison.scenario_b'),
      value: receiptScenarioB.bondType,
      editTargetId: 'comparison-scenarios-setup',
    },
    {
      label: t('comparison.maturity_policy'),
      value:
        receiptSharedConfig.strategyPolicy === 'cash_after_maturity'
          ? t('comparison.maturity_cash')
          : receiptSharedConfig.strategyPolicy === 'hold_to_maturity'
            ? t('comparison.maturity_hold')
            : t('comparison.maturity_reinvest'),
      editTargetId: 'comparison-shared-setup',
    },
    {
      label: t('comparison.coupon_policy'),
      value:
        receiptSharedConfig.couponDisposition === 'cash'
          ? t('comparison.coupon_cash')
          : t('comparison.coupon_reinvest'),
      editTargetId: 'comparison-shared-setup',
    },
    ...(
      [
        ['A', receiptScenarioA],
        ['B', receiptScenarioB],
      ] as const
    ).flatMap(([label, scenario]) => [
      ...(scenario.purchaseDate
        ? [{ label: `${label} · ${t('bonds.purchase_date')}`, value: scenario.purchaseDate }]
        : []),
      ...(scenario.withdrawalDate
        ? [{ label: `${label} · ${t('bonds.withdrawal_date')}`, value: scenario.withdrawalDate }]
        : []),
      ...(scenario.investmentHorizonMonths
        ? [
            {
              label: `${label} · ${t('bonds.investment_horizon')}`,
              value: formatHorizonMonths(scenario.investmentHorizonMonths, language),
            },
          ]
        : []),
      ...(scenario.strategyPolicy
        ? [
            {
              label: `${label} · ${t('comparison.maturity_policy')}`,
              value:
                scenario.strategyPolicy === 'cash_after_maturity'
                  ? t('comparison.maturity_cash')
                  : scenario.strategyPolicy === 'hold_to_maturity'
                    ? t('comparison.maturity_hold')
                    : t('comparison.maturity_reinvest'),
            },
          ]
        : []),
      ...(scenario.couponDisposition
        ? [
            {
              label: `${label} · ${t('comparison.coupon_policy')}`,
              value:
                scenario.couponDisposition === 'cash'
                  ? t('comparison.coupon_cash')
                  : t('comparison.coupon_reinvest'),
            },
          ]
        : []),
      ...(scenario.taxStrategy
        ? [
            {
              label: `${label} · ${t('bonds.tax_strategy')}`,
              value: t(
                scenario.taxStrategy === 'IKE'
                  ? 'bonds.tax_ike'
                  : scenario.taxStrategy === 'IKZE'
                    ? 'bonds.tax_ikze'
                    : 'bonds.tax_standard',
              ),
            },
          ]
        : []),
    ]),
  ];
  const showPlanReceipt = hasComparisonResults && !isPlanOpen;

  return (
    <CalculatorPageShell
      title={t('nav.comparison')}
      description={t('comparison.desc_independent')}
      icon={<Scale className="h-8 w-8" />}
      isCalculating={isCalculating}
      isDirty={isDirty}
      hasResults={hasComparisonResults}
      onKeyDown={handleKeyDown}
    >
      <div className="ui-page-flow">
        <div className="flex flex-wrap justify-end gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file
                .text()
                .then((text) => {
                  const decoded = parseScenarioPackage(text);
                  if (decoded.ok && isComparisonPortableScenario(decoded.scenario)) {
                    const next = {
                      sharedConfig: decoded.scenario.intent.sharedConfig,
                      scenarioA: decoded.scenario.intent.scenarioA,
                      scenarioB: decoded.scenario.intent.scenarioB,
                    };
                    if (isDirty) setPendingImport(next);
                    else restorePortableScenario(next);
                  }
                })
                .finally(() => {
                  event.target.value = '';
                });
            }}
          />
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            {t('comparison.import_package')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadJsonFile(
                JSON.parse(
                  serializeScenarioPackage(
                    createComparisonScenarioPackage({
                      mode: 'independent',
                      sharedConfig,
                      scenarioA,
                      scenarioB,
                    }),
                  ),
                ),
                'bond-comparison.scenario.json',
              )
            }
          >
            <Download className="mr-1 h-4 w-4" />
            {t('comparison.export_package')}
          </Button>
        </div>
        {pendingImport ? (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
            <p>{t('comparison.import_dirty')}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  restorePortableScenario(pendingImport);
                  setPendingImport(null);
                }}
              >
                {t('comparison.import_confirm')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingImport(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
        <div ref={planRef}>
          {showPlanReceipt ? (
            <ComparisonPlanReceipt
              isOpen={false}
              planLabel={t('common.scenario_plan')}
              editLabel={t('common.edit_plan')}
              closeLabel={t('common.close_plan')}
              summary={planSummary}
              onOpenChange={handlePlanOpenChange}
              editButtonRef={receiptEditRef}
              jumpToResultsLabel={t('common.jump_to_results')}
            />
          ) : (
            <>
              {hasComparisonResults ? (
                <ComparisonPlanReceipt
                  isOpen
                  planLabel={t('common.scenario_plan')}
                  editLabel={t('common.edit_plan')}
                  closeLabel={t('common.close_plan')}
                  summary={planSummary}
                  onOpenChange={handlePlanOpenChange}
                />
              ) : null}
              <div data-comparison-plan>
                <ComparisonPlanWorkspace
                  sharedConfig={sharedConfig}
                  assumptionsBondType={assumptionsBondType}
                  durationMismatchTitle={t('comparison.auto_rollover_notice_title')}
                  durationMismatchText={durationMismatchText}
                  hasResults={!!resultsA && !!resultsB}
                  isCalculating={isCalculating}
                  onCalculate={calculate}
                  onUpdateSharedConfig={onSharedConfigChange}
                  scenarioA={{
                    title: t('comparison.scenario_a'),
                    colorClass: 'scenario-a',
                    scenario: scenarioA,
                    onBondTypeChange: (bondType) => {
                      onBondTypeChange('A', bondType);
                    },
                    onTaxStrategyChange: (value) => onScenarioChange('A', 'taxStrategy', value),
                    onStrategyPolicyChange: (value) =>
                      onScenarioChange('A', 'strategyPolicy', value),
                    onCouponDispositionChange: (value) =>
                      onScenarioChange('A', 'couponDisposition', value),
                    onCustomHorizonEnabledChange: (enabled) =>
                      onCustomHorizonChange('A', undefined, enabled),
                    onCustomHorizonMonthsChange: (value) => onCustomHorizonChange('A', value),
                  }}
                  scenarioB={{
                    title: t('comparison.scenario_b'),
                    colorClass: 'scenario-b',
                    scenario: scenarioB,
                    onBondTypeChange: (bondType) => {
                      onBondTypeChange('B', bondType);
                    },
                    onTaxStrategyChange: (value) => onScenarioChange('B', 'taxStrategy', value),
                    onStrategyPolicyChange: (value) =>
                      onScenarioChange('B', 'strategyPolicy', value),
                    onCouponDispositionChange: (value) =>
                      onScenarioChange('B', 'couponDisposition', value),
                    onCustomHorizonEnabledChange: (enabled) =>
                      onCustomHorizonChange('B', undefined, enabled),
                    onCustomHorizonMonthsChange: (value) => onCustomHorizonChange('B', value),
                  }}
                  sharedBaseLabel={t('comparison.shared_base')}
                />
              </div>
            </>
          )}
        </div>

        {resultsA && resultsB ? (
          <div id="comparison-results" ref={resultsRef} tabIndex={-1}>
            <ComparisonCommittedResults
              chartData={chartData}
              chartStep={chartStep}
              envelopeA={envelopeA}
              envelopeB={envelopeB}
              formatCurrency={formatCurrency}
              hasMounted={hasMounted}
              inputsA={resultInputsA}
              inputsB={resultInputsB}
              isCalculating={isCalculating}
              isDirty={isDirty}
              language={language}
              onChartStepChange={setChartStep}
              resultsA={resultsA}
              resultsB={resultsB}
              scenarioAColor={scenarioAColor}
              scenarioBColor={scenarioBColor}
              staleResultsLabel={t('comparison.stale_results')}
              usesMixedTimelineCadence={hasMixedTimelineCadence}
              warningsA={warningsA}
              warningsB={warningsB}
            />
          </div>
        ) : null}
      </div>
      <RecalculateButton
        isDirty={isDirty}
        hasResults={!!resultsA && !!resultsB}
        loading={isCalculating}
        onClick={() => calculate()}
      />
    </CalculatorPageShell>
  );
};
