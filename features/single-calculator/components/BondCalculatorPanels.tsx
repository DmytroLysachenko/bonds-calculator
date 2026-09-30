'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  BondInputs,
  CalculationResult,
  SingleBondCalculationEnvelope,
} from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { CalculatorLoadingState } from '@/shared/components/feedback/CalculatorLoadingState';
import { ScenarioReadyPanel } from '@/shared/components/feedback/ScenarioReadyPanel';

import { InputGuardrailIssue } from '../lib/input-guardrails';

import { SensitivityPanel } from './SensitivityPanel';

const BondResultsSummary = dynamic(
  () => import('./BondResultsSummary').then((module) => module.BondResultsSummary),
  { loading: () => <Skeleton className="h-72 w-full rounded-md" /> },
);

const BondCalculatorDetailsContent = dynamic(
  () =>
    import('./BondCalculatorDetailsContent').then((module) => module.BondCalculatorDetailsContent),
  { loading: () => <Skeleton className="h-[360px] w-full rounded-md md:h-[460px]" /> },
);

interface BondCalculatorResultsPanelProps {
  results: CalculationResult | null;
  inputs: BondInputs;
  envelope: SingleBondCalculationEnvelope | null;
  isCalculating: boolean;
  isDirty: boolean;
  blockingGuardrails: InputGuardrailIssue[];
  canManageWorkspace: boolean;
  onSaveScenario: () => void | Promise<void>;
  onAddToNotebook: () => void | Promise<void>;
  onExportPDF: () => void | Promise<void>;
  onPrepareSensitivityDraft: (inputs: BondInputs) => void;
}

interface BondCalculatorDetailsPanelProps {
  results: CalculationResult | null;
  inputs: BondInputs;
  envelope: SingleBondCalculationEnvelope | null;
  isCalculating: boolean;
  readingGuide: string[];
}

export function BondCalculatorResultsPanel({
  results,
  inputs,
  envelope,
  isCalculating,
  isDirty,
  blockingGuardrails,
  canManageWorkspace,
  onSaveScenario,
  onAddToNotebook,
  onExportPDF,
  onPrepareSensitivityDraft,
}: BondCalculatorResultsPanelProps) {
  const { t } = useAppI18n();

  return (
    <div id="bond-report-content" className="min-w-0">
      {!results && !isCalculating ? (
        <ScenarioReadyPanel
          badge={t('bonds.simulation.ready')}
          title={t('bonds.simulation.ready_title')}
          description={t('bonds.simulation.ready_desc')}
          steps={[
            {
              id: 'primary',
              title: t('bonds.simulation.ready_steps.primary.title'),
              description: t('bonds.simulation.ready_steps.primary.desc'),
            },
            {
              id: 'timing',
              title: t('bonds.simulation.ready_steps.timing.title'),
              description: t('bonds.simulation.ready_steps.timing.desc'),
            },
            {
              id: 'advanced',
              title: t('bonds.simulation.ready_steps.advanced.title'),
              description: t('bonds.simulation.ready_steps.advanced.desc'),
            },
          ]}
          footerText={
            blockingGuardrails.length > 0
              ? t('bonds.simulation.fix_blocking')
              : t('bonds.simulation.results_stable')
          }
          stepsLabel={t('bonds.simulation.ready_steps_label')}
        />
      ) : null}

      {isCalculating && !results ? <CalculatorLoadingState /> : null}

      {results ? (
        <div
          className={cn(
            'ui-compact-flow transition-opacity duration-200',
            isCalculating && 'pointer-events-none opacity-50',
          )}
        >
          {isDirty ? (
            <div className="ui-status-note ui-status-note-warning text-foreground" role="status">
              <span className="ui-body text-foreground">{t('bonds.simulation.stale_results')}</span>
              <span className="ui-meta font-semibold text-foreground">
                {t('common.recalculate')}.
              </span>
            </div>
          ) : null}

          <BondResultsSummary
            results={results}
            inputs={inputs}
            onSaveScenario={onSaveScenario}
            onAddToNotebook={onAddToNotebook}
            onExportPDF={onExportPDF}
            canManageWorkspace={canManageWorkspace}
            dataQualityFlags={envelope?.dataQualityFlags}
            envelope={envelope}
          />
          <SensitivityPanel inputs={inputs} onPrepareDraft={onPrepareSensitivityDraft} />
        </div>
      ) : null}
    </div>
  );
}

export function BondCalculatorDetailsPanel({
  results,
  inputs,
  envelope,
  isCalculating,
  readingGuide,
}: BondCalculatorDetailsPanelProps) {
  if (!results) {
    return null;
  }

  return (
    <BondCalculatorDetailsContent
      results={results}
      inputs={inputs}
      envelope={envelope}
      isCalculating={isCalculating}
      readingGuide={readingGuide}
    />
  );
}
