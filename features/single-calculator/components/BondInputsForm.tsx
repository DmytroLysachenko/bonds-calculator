'use client';

import { parseISO } from 'date-fns';
import { Target } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppI18n } from '@/i18n/client';
import { AdvancedAssumptionsDisclosure } from '@/shared/components/forms/AdvancedAssumptionsDisclosure';
import { FormInlineNotice } from '@/shared/components/forms/FormInlineNotice';
import { FormSection } from '@/shared/components/forms/FormSection';
import { DeferredMarketAssumptionsForm } from '@/shared/components/market-assumptions/DeferredMarketAssumptionsForm';
import type { AssumptionSetupMode } from '@/shared/components/MarketAssumptionsForm';
import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { useHasMounted } from '@/shared/hooks/useHasMounted';
import { getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

import { BondInputs, BondType } from '../../bond-core/types';
import { buildBondInputsViewModel } from '../lib/bond-inputs-view-model';
import { InputGuardrailIssue } from '../lib/input-guardrails';

import { BondConfigSection } from './sections/BondConfigSection';
import { BondSummaryFooter } from './sections/BondSummaryFooter';
import { BondTimingSection } from './sections/BondTimingSection';

interface BondSeries {
  id: string;
  seriesCode: string;
  firstYearRate: string | number;
  baseMargin: string | number | null;
  emissionMonth: string;
}

interface BondInputsFormProps {
  formId?: string;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  inputs: BondInputs;
  onUpdate: (key: keyof BondInputs, value: unknown) => void;
  onBondTypeChange: (type: BondType, horizonChoice: 'preserve' | 'native') => void;
  availableSeries?: BondSeries[];
  selectedSeriesId?: string | null;
  guardrails?: InputGuardrailIssue[];
  onApplyGuardrailFix?: (issue: InputGuardrailIssue) => void;
  guardrailSummaryRef?: React.RefObject<HTMLDivElement | null>;
}

export const BondInputsForm: React.FC<BondInputsFormProps> = ({
  formId,
  onSubmit,
  inputs,
  onUpdate,
  onBondTypeChange,
  availableSeries = [],
  selectedSeriesId = 'current',
  guardrails = [],
  onApplyGuardrailFix,
  guardrailSummaryRef,
}) => {
  const { t } = useAppI18n();
  const { definitions, isLoading: isLoadingDefs } = useBondDefinitions();
  const hasMounted = useHasMounted();
  const [inflationSetupMode, setInflationSetupMode] = useState<AssumptionSetupMode>('fixed');
  const [nbpSetupMode, setNbpSetupMode] = useState<AssumptionSetupMode>('fixed');
  const [isInflationAssumptionsOpen, setIsInflationAssumptionsOpen] = useState(false);
  const [isNbpAssumptionsOpen, setIsNbpAssumptionsOpen] = useState(false);

  const handleUpdate = useCallback(
    (key: keyof BondInputs, value: unknown) => {
      onUpdate(key, value);
    },
    [onUpdate],
  );

  const currentDef = definitions?.[inputs.bondType];
  const viewModel = buildBondInputsViewModel(inputs);
  const maturityDate = useMemo(
    () =>
      parseISO(getWithdrawalDateFromMonths(inputs.purchaseDate, Math.round(inputs.duration * 12))),
    [inputs.duration, inputs.purchaseDate],
  );

  if (isLoadingDefs || !definitions || !currentDef) {
    return (
      <section
        className="ui-form-panel w-full space-y-6"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <div className="space-y-3">
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <TooltipProvider>
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className="ui-form-panel w-full space-y-7"
        aria-label={t('bonds.single_calculator')}
      >
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
                action={
                  issue.autoFixLabel && onApplyGuardrailFix ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ui-focus-ring h-9 shrink-0 text-xs font-medium"
                      onClick={() => onApplyGuardrailFix(issue)}
                    >
                      {issue.autoFixLabel}
                    </Button>
                  ) : null
                }
              />
            ))}
          </div>
        ) : null}

        <div className="ui-section-intro border-b border-border pb-5">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="ui-kicker">{t('bonds.simulation.ready')}</p>
          </div>
          <h2 className="ui-section-title">{t('bonds.single_calculator')}</h2>
          <p className="ui-body text-muted-foreground">{t('bonds.form.main_path_desc')}</p>
        </div>

        <div className="ui-control-stack">
          <FormSection
            id="single-core-setup"
            title={t('bonds.step_core')}
            description={t('bonds.form.step_core_desc')}
            headingLevel="h3"
            className="border-t-0 pt-0"
            contentClassName="pt-2"
          >
            <BondConfigSection
              inputs={inputs}
              onUpdate={handleUpdate}
              onBondTypeChange={onBondTypeChange}
              definitions={definitions}
              availableSeries={availableSeries}
              selectedSeriesId={selectedSeriesId}
            />
          </FormSection>

          <FormSection
            id="single-timing-setup"
            title={t('bonds.step_timing')}
            description={t('bonds.form.step_timing_desc')}
            headingLevel="h3"
            className="border-t-0 pt-0"
            contentClassName="pt-2"
          >
            <BondTimingSection
              inputs={inputs}
              onUpdate={handleUpdate}
              investmentHorizonYears={viewModel.investmentHorizonYears}
              investmentHorizonMonths={viewModel.investmentHorizonMonths}
              currentDef={currentDef}
              hasMounted={hasMounted}
            />
          </FormSection>

          {viewModel.usesInflation ? (
            <AdvancedAssumptionsDisclosure
              title={t('bonds.form.step_inflation_title')}
              description={t('bonds.form.step_inflation_desc')}
              onOpenChange={setIsInflationAssumptionsOpen}
            >
              {isInflationAssumptionsOpen ? (
                <DeferredMarketAssumptionsForm
                  expectedInflation={inputs.expectedInflation}
                  expectedNbpRate={inputs.expectedNbpRate}
                  bondType={inputs.bondType}
                  customInflation={inputs.customInflation}
                  customNbpRate={inputs.customNbpRate}
                  inflationHorizonYears={viewModel.assumptionHorizonYears}
                  onUpdate={handleUpdate as (key: string, value: unknown) => void}
                  compact
                  section="inflation"
                  showIntro={false}
                  inflationSetupMode={inflationSetupMode}
                  onInflationSetupModeChange={setInflationSetupMode}
                />
              ) : null}
            </AdvancedAssumptionsDisclosure>
          ) : null}

          {viewModel.usesNbpRate ? (
            <AdvancedAssumptionsDisclosure
              title={t('bonds.form.step_nbp_title')}
              description={t('bonds.form.step_nbp_desc')}
              onOpenChange={setIsNbpAssumptionsOpen}
            >
              {isNbpAssumptionsOpen ? (
                <DeferredMarketAssumptionsForm
                  expectedInflation={inputs.expectedInflation}
                  expectedNbpRate={inputs.expectedNbpRate}
                  bondType={inputs.bondType}
                  customInflation={inputs.customInflation}
                  customNbpRate={inputs.customNbpRate}
                  inflationHorizonYears={viewModel.assumptionHorizonYears}
                  onUpdate={handleUpdate as (key: string, value: unknown) => void}
                  compact
                  section="nbp"
                  showIntro={false}
                  nbpSetupMode={nbpSetupMode}
                  onNbpSetupModeChange={setNbpSetupMode}
                />
              ) : null}
            </AdvancedAssumptionsDisclosure>
          ) : null}
        </div>

        <BondSummaryFooter
          inputs={inputs}
          currentDef={currentDef}
          maturityDate={maturityDate}
          hasMounted={hasMounted}
        />
        <button
          type="submit"
          tabIndex={-1}
          className="sr-only"
          aria-label={t('common.calculate')}
        />
      </form>
    </TooltipProvider>
  );
};
