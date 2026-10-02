'use client';
import { Wallet } from 'lucide-react';
import React, { useMemo } from 'react';

import { TaxStrategy } from '@/features/bond-core/types';
import {
  RetirementPlannerCalculationEnvelope,
  ScenarioKind,
} from '@/features/bond-core/types/scenarios';
import { DEFAULT_RETIREMENT_INPUTS } from '@/features/retirement/constants/default-inputs';
import { formatRetirementRate } from '@/features/retirement/lib/retirement-format';
import {
  createRetirementChartData,
  createRetirementModelLimits,
  createRetirementPlannerLabels,
  createRetirementScenarioCoverage,
  createRetirementTaxStrategyLabels,
  getRetirementTaxStrategyLabel,
  getSupportedRetirementBondType,
} from '@/features/retirement/lib/retirement-planner-model';
import { RetirementInputs } from '@/features/retirement/types/retirement';
import { useAppI18n } from '@/i18n/client';
import { RecalculateButton } from '@/shared/components/feedback/RecalculateButton';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { useCalculatorWorkflow } from '@/shared/hooks/useCalculatorWorkflow';
import { useCurrencyFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { useMacroAssumptionDefaults } from '@/shared/hooks/useMacroAssumptionDefaults';
import { getCalculationEndpoint } from '@/shared/lib/calculation-endpoints';
import { logClientError } from '@/shared/lib/client-logger';

import { RetirementInputsPanel } from './RetirementInputsPanel';
import {
  RetirementDepletionWarning,
  RetirementLimitsPanel,
  RetirementReadyStatePanel,
  RetirementResultsPanel,
} from './RetirementPlannerPanels';

export const RetirementPlannerContainer: React.FC = () => {
  const { t, locale: language } = useAppI18n();
  const { defaults: macroDefaults } = useMacroAssumptionDefaults();
  const workflow = useCalculatorWorkflow<RetirementInputs, RetirementPlannerCalculationEnvelope>({
    initialInputs: DEFAULT_RETIREMENT_INPUTS,
  });
  const currencyFormatter = useCurrencyFormatter(language, {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  });
  const { draftInputs: inputs, committedResult: results, setDraftInputs } = workflow;
  const resultInputs = workflow.committedInputs ?? inputs;
  const hasTouchedMacroAssumptions = React.useRef(false);
  const formatCurrency = React.useCallback(
    (value: number) => currencyFormatter.format(value),
    [currencyFormatter],
  );
  React.useEffect(() => {
    if (!macroDefaults || hasTouchedMacroAssumptions.current) {
      return;
    }
    if (
      inputs.expectedInflation === macroDefaults.expectedInflation &&
      inputs.expectedNbpRate === macroDefaults.expectedNbpRate
    ) {
      return;
    }
    setDraftInputs({
      ...inputs,
      expectedInflation: macroDefaults.expectedInflation,
      expectedNbpRate: macroDefaults.expectedNbpRate,
    });
  }, [inputs, macroDefaults, setDraftInputs]);
  const handleCalculate = async () => {
    try {
      await workflow.runRemoteCalculation(
        getCalculationEndpoint(ScenarioKind.RETIREMENT_PLANNER),
        (draft) => ({
          ...draft,
          bondType: getSupportedRetirementBondType(draft.bondType),
          projectionStartDate: new Date().toISOString().slice(0, 10),
        }),
      );
    } catch (error) {
      logClientError('Retirement calculation error:', error);
    }
  };
  const chartData = useMemo(() => createRetirementChartData(results), [results]);
  const scenarioCoverage = useMemo(
    () => createRetirementScenarioCoverage(results, language),
    [language, results],
  );
  const labels = createRetirementPlannerLabels(t);
  const taxStrategyLabels: Record<TaxStrategy, string> = createRetirementTaxStrategyLabels(t);
  const modelLimits = createRetirementModelLimits(t);
  const updateInput = <K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) => {
    if (key === 'expectedInflation' || key === 'expectedNbpRate') {
      hasTouchedMacroAssumptions.current = true;
    }
    setDraftInputs({ ...inputs, [key]: value });
  };
  return (
    <CalculatorPageShell
      title={labels.pageTitle}
      description={labels.pageDescription}
      icon={<Wallet className="h-8 w-8" />}
      isCalculating={workflow.isCalculating}
      isDirty={workflow.isDirty}
      hasResults={!!results}
    >
      <div className="ui-page-flow grid grid-cols-1 xl:grid-cols-12 xl:gap-10">
        <aside
          className="ui-control-stack xl:sticky xl:top-8 xl:col-span-4 xl:h-fit"
          aria-label={labels.pageTitle}
        >
          <RetirementInputsPanel
            inputs={inputs}
            language={language}
            labels={labels}
            taxStrategyLabels={taxStrategyLabels}
            formatCurrency={formatCurrency}
            formatRate={formatRetirementRate}
            onUpdateInput={updateInput}
          />
        </aside>

        <section className="ui-compact-flow min-w-0 xl:col-span-8" aria-live="polite">
          {results ? (
            <RetirementResultsPanel
              results={results}
              isDirty={workflow.isDirty}
              labels={labels}
              chartData={chartData}
              scenarioCoverage={scenarioCoverage}
              language={language}
              inputsHorizonYears={resultInputs.horizonYears}
              assumptions={[
                t('retirement_page.model_assumptions.horizon', {
                  years: resultInputs.horizonYears,
                }),
                t('retirement_page.model_assumptions.withdrawal', {
                  amount: formatCurrency(resultInputs.monthlyWithdrawal),
                }),
                t('retirement_page.model_assumptions.family', { family: resultInputs.bondType }),
                t('retirement_page.model_assumptions.rate', {
                  rate: formatRetirementRate(results.result.modeledAnnualRate),
                }),
                t('retirement_page.model_assumptions.timing'),
                t('retirement_page.model_assumptions.margin'),
                t('retirement_page.model_assumptions.tax'),
              ]}
              taxStrategyLabel={getRetirementTaxStrategyLabel(
                taxStrategyLabels,
                resultInputs.taxStrategy,
              )}
              formatCurrency={formatCurrency}
            />
          ) : (
            <RetirementReadyStatePanel
              inputs={inputs}
              labels={labels}
              language={language}
              formatCurrency={formatCurrency}
              t={t}
            />
          )}

          <RetirementLimitsPanel labels={labels} modelLimits={modelLimits} />

          <RetirementDepletionWarning
            exhaustionDate={results?.result.exhaustionDate}
            labels={labels}
          />
        </section>
      </div>

      <RecalculateButton
        isDirty={workflow.isDirty}
        loading={workflow.isCalculating}
        hasResults={!!results}
        onClick={handleCalculate}
      />
    </CalculatorPageShell>
  );
};
