'use client';

import type { BondType } from '@/features/bond-core/types';
import type { FieldUpdater } from '@/shared/types/field-updater';

import type { ScenarioOverride, SharedComparisonConfig } from '../lib/comparison-calculator-state';

import { comparisonLayout } from './comparison-layout';
import { ComparisonFairnessPanel, ComparisonSetupStatePanel } from './ComparisonContainerPanels';
import {
  ComparisonSharedAssumptionsPanel,
  ComparisonSharedBaseCard,
} from './ComparisonSharedBaseCard';
import { ScenarioOverrideCard } from './ScenarioOverrideCard';

type SharedConfigUpdate = FieldUpdater<SharedComparisonConfig>;

interface ComparisonScenarioControls {
  colorClass: 'scenario-a' | 'scenario-b';
  scenario: ScenarioOverride;
  title: string;
  onBondTypeChange: (bondType: BondType) => void;
  onCustomHorizonEnabledChange: (enabled: boolean) => void;
  onCustomHorizonMonthsChange: (value: number | undefined) => void;
  onTaxStrategyChange: (value: ScenarioOverride['taxStrategy']) => void;
  onStrategyPolicyChange: (value: ScenarioOverride['strategyPolicy']) => void;
  onCouponDispositionChange: (value: ScenarioOverride['couponDisposition']) => void;
}

interface ComparisonPlanWorkspaceProps {
  assumptionsBondType: BondType;
  durationMismatchText: string | null;
  durationMismatchTitle: string;
  hasResults: boolean;
  isCalculating: boolean;
  onCalculate: () => void;
  onUpdateSharedConfig: SharedConfigUpdate;
  scenarioA: ComparisonScenarioControls;
  scenarioB: ComparisonScenarioControls;
  sharedBaseLabel: string;
  sharedConfig: SharedComparisonConfig;
}

/** Draft-only comparison controls. URL persistence and calculation state stay outside. */
export function ComparisonPlanWorkspace({
  assumptionsBondType,
  durationMismatchText,
  durationMismatchTitle,
  hasResults,
  isCalculating,
  onCalculate,
  onUpdateSharedConfig,
  scenarioA,
  scenarioB,
  sharedBaseLabel,
  sharedConfig,
}: ComparisonPlanWorkspaceProps) {
  return (
    <>
      <div className={comparisonLayout.workspace}>
        <aside
          id="comparison-shared-setup"
          className={comparisonLayout.sharedBase}
          aria-label={sharedBaseLabel}
        >
          <ComparisonSharedBaseCard
            sharedConfig={sharedConfig}
            onUpdateSharedConfig={onUpdateSharedConfig}
          />
        </aside>

        <div className="min-w-0 ui-compact-flow">
          <div id="comparison-scenarios-setup" className={comparisonLayout.scenarioGrid}>
            {[scenarioA, scenarioB].map((scenario) => (
              <ScenarioOverrideCard
                key={scenario.colorClass}
                title={scenario.title}
                colorClass={scenario.colorClass}
                bondType={scenario.scenario.bondType}
                onBondTypeChange={scenario.onBondTypeChange}
                taxStrategy={scenario.scenario.taxStrategy}
                onTaxStrategyChange={scenario.onTaxStrategyChange}
                strategyPolicy={scenario.scenario.strategyPolicy}
                onStrategyPolicyChange={scenario.onStrategyPolicyChange}
                couponDisposition={scenario.scenario.couponDisposition}
                onCouponDispositionChange={scenario.onCouponDispositionChange}
                customHorizonEnabled={scenario.scenario.investmentHorizonMonths !== undefined}
                onCustomHorizonEnabledChange={scenario.onCustomHorizonEnabledChange}
                customHorizonMonths={scenario.scenario.investmentHorizonMonths}
                onCustomHorizonMonthsChange={scenario.onCustomHorizonMonthsChange}
              />
            ))}
          </div>

          <ComparisonFairnessPanel
            durationMismatchTitle={durationMismatchTitle}
            durationMismatchText={durationMismatchText}
            hasResults={hasResults}
            isCalculating={isCalculating}
            onCalculate={onCalculate}
          />

          <ComparisonSetupStatePanel hasResults={hasResults} isCalculating={isCalculating} />
        </div>
      </div>

      <div id="comparison-assumptions-setup">
        <ComparisonSharedAssumptionsPanel
          sharedConfig={sharedConfig}
          assumptionsBondType={assumptionsBondType}
          onUpdateSharedConfig={onUpdateSharedConfig}
        />
      </div>
    </>
  );
}
