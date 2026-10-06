'use client';
import React, { useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { buildContributionSchedule } from '@/features/bond-core/utils/engine/contribution-schedule';
import { useAppI18n } from '@/i18n/client';
import { getDateFnsLocale } from '@/i18n/locale-utils';
import { FormInlineNotice } from '@/shared/components/forms/FormInlineNotice';
import { ScenarioFieldset } from '@/shared/components/forms/ScenarioFieldset';
import { ParameterSummary } from '@/shared/components/results/ParameterSummary';
import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { getHorizonMonths } from '@/shared/lib/date-timing';
import { formatBondDuration } from '@/shared/lib/format-bond-duration';
import { type FieldUpdater } from '@/shared/types/field-updater';

import { BondType, RegularInvestmentInputs } from '../../bond-core/types';
import { RegularInvestmentGuardrail } from '../lib/regular-investment-guardrails';

import { AdvancedSettingsSection } from './inputs/AdvancedSettingsSection';
import { AllocationStrategySection } from './inputs/AllocationStrategySection';
import { BondSelectionSection } from './inputs/BondSelectionSection';
import { ContributionPlanSection } from './inputs/ContributionPlanSection';
import { TimingSection } from './inputs/TimingSection';

interface RegularInvestmentInputsFormProps {
  inputs: RegularInvestmentInputs;
  onUpdate: FieldUpdater<RegularInvestmentInputs>;
  onBondTypeChange: (type: BondType, horizonChoice: 'preserve' | 'native') => void;
  action?: React.ReactNode;
  guardrails?: RegularInvestmentGuardrail[];
  guardrailSummaryRef?: React.RefObject<HTMLDivElement | null>;
}

export const RegularInvestmentInputsForm: React.FC<RegularInvestmentInputsFormProps> = React.memo(
  ({ inputs, onUpdate, onBondTypeChange, action, guardrails = [], guardrailSummaryRef }) => {
    const { t, locale: language } = useAppI18n();
    const { definitions, isLoading: isLoadingDefs } = useBondDefinitions();
    const [showCustomTax, setShowCustomTax] = useState(false);

    if (isLoadingDefs || !definitions) {
      return (
        <section
          className="ui-form-panel w-full space-y-7"
          aria-busy="true"
          aria-label={t('common.loading')}
        >
          <div className="space-y-3 border-b border-border pb-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </div>
        </section>
      );
    }

    const currentDef = definitions[inputs.bondType];
    const dateLocale = getDateFnsLocale(language);
    const investmentHorizonMonths =
      inputs.investmentHorizonMonths ??
      getHorizonMonths(inputs.purchaseDate, inputs.withdrawalDate);
    const investmentHorizonYears = Math.max(1 / 12, investmentHorizonMonths / 12);
    return (
      <section
        className="ui-form-panel w-full ui-control-stack"
        aria-label={t('bonds.regular_calculator')}
      >
        <div className="ui-section-intro border-b border-border pb-5">
          <h2 className="ui-section-title">{t('bonds.regular_calculator')}</h2>
          <p className="ui-body text-muted-foreground">
            {t('regular_investment_page.form_description')}
          </p>
        </div>
        {guardrails.length > 0 ? (
          <div
            ref={guardrailSummaryRef}
            tabIndex={-1}
            className="ui-control-stack"
            role="alert"
            aria-live="assertive"
          >
            {guardrails.map((issue) => (
              <FormInlineNotice
                key={issue.id}
                tone="warning"
                title={`${issue.severity}: ${issue.title}`}
                description={issue.description}
              />
            ))}
          </div>
        ) : null}
        <div className="ui-control-stack">
          <ScenarioFieldset
            id="regular-instrument-setup"
            title={t('regular_investment_page.core_plan_title')}
            description={t('regular_investment_page.core_plan_description')}
          >
            <BondSelectionSection
              bondType={inputs.bondType}
              definitions={definitions}
              language={language}
              onBondTypeChange={onBondTypeChange}
              t={t}
            />
          </ScenarioFieldset>

          <ScenarioFieldset id="regular-budget-setup" title={t('comparison.configuration')} divided>
            <ContributionPlanSection
              contributionAmount={inputs.contributionAmount}
              initialLumpSum={inputs.initialLumpSum ?? 0}
              annualContributionIncreasePercent={inputs.annualContributionIncreasePercent ?? 0}
              oneOffContributions={inputs.oneOffContributions ?? []}
              skippedContributionDates={inputs.skippedContributionDates ?? []}
              contributionOverrides={inputs.contributionOverrides ?? []}
              previewRows={buildContributionSchedule(inputs)}
              investmentHorizonMonths={investmentHorizonMonths}
              language={language}
              frequency={inputs.frequency}
              taxStrategy={inputs.taxStrategy}
              onUpdate={onUpdate}
              t={t}
            />
          </ScenarioFieldset>

          <ScenarioFieldset id="regular-timing-setup" title={t('bonds.step_timing')} divided>
            <TimingSection
              timingMode={inputs.timingMode}
              purchaseDate={inputs.purchaseDate}
              withdrawalDate={inputs.withdrawalDate}
              investmentHorizonYears={investmentHorizonYears}
              dateLocale={dateLocale}
              onUpdate={onUpdate}
              t={t}
            />
          </ScenarioFieldset>

          <ScenarioFieldset
            id="regular-policy-setup"
            title={t('regular_investment_page.allocation_title')}
            divided
          >
            <AllocationStrategySection inputs={inputs} onUpdate={onUpdate} t={t} />
          </ScenarioFieldset>

          <ScenarioFieldset id="regular-advanced-setup" title={t('common.advanced')} divided>
            <AdvancedSettingsSection
              inputs={inputs}
              currentDef={currentDef}
              showCustomTax={showCustomTax}
              onShowCustomTaxChange={setShowCustomTax}
              onUpdate={onUpdate}
              t={t}
            />
          </ScenarioFieldset>

          <ParameterSummary
            variant="compact"
            items={[
              {
                label: t('bonds.duration'),
                value: formatBondDuration(inputs.duration, language),
              },
              {
                label:
                  inputs.bondType === 'OTS'
                    ? t('bonds.yield_three_months')
                    : inputs.bondType === 'ROR' || inputs.bondType === 'DOR'
                      ? t('bonds.first_month_rate')
                      : t('bonds.first_year_rate'),
                value: `${inputs.firstYearRate}%`,
              },
              ...(currentDef.margin > 0
                ? [
                    {
                      label: t('bonds.margin'),
                      value: `${inputs.margin}%`,
                    },
                  ]
                : []),
              {
                label: t('bonds.payout_type'),
                value: inputs.isCapitalized ? t('bonds.capitalization') : t('bonds.payout'),
              },
              {
                label: t('bonds.early_withdrawal_fee'),
                value: `${inputs.earlyWithdrawalFee} PLN`,
              },
            ]}
          />
          {action ? <div className="border-t border-border pt-5">{action}</div> : null}
        </div>
      </section>
    );
  },
);

RegularInvestmentInputsForm.displayName = 'RegularInvestmentInputsForm';
