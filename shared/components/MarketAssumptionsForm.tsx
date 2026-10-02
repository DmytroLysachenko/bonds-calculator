'use client';
import React from 'react';

import { BondInputs, BondType } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { AssumptionSemanticsNote } from '@/shared/components/market-assumptions/AssumptionSemanticsNote';
import { MacroDefaultsSummary } from '@/shared/components/market-assumptions/MacroDefaultsSummary';
import {
  InflationAssumptionSection,
  NbpAssumptionSection,
} from '@/shared/components/market-assumptions/MarketAssumptionSections';
import {
  isFloatingNbpBondType,
  isInflationIndexedBondType,
} from '@/shared/lib/market-assumption-semantics';
import {
  type AssumptionSetupMode,
  getHeaderAssumptionValue,
  resolveAssumptionModeUpdate,
} from '@/shared/lib/market-assumptions-form-model';
import { type FieldUpdater } from '@/shared/types/field-updater';

export type { AssumptionSetupMode } from '@/shared/lib/market-assumptions-form-model';

export type MarketAssumptionFields = Pick<
  BondInputs,
  'expectedInflation' | 'expectedNbpRate' | 'customInflation' | 'customNbpRate'
>;
type UpdateHandler = FieldUpdater<MarketAssumptionFields>;
export interface MarketAssumptionsFormProps {
  expectedInflation: number;
  expectedNbpRate?: number;
  bondType: BondType;
  customInflation?: number[];
  customNbpRate?: number[];
  onUpdate: UpdateHandler;
  compact?: boolean;
  inflationHorizonYears?: number;
  section?: 'all' | 'inflation' | 'nbp';
  showIntro?: boolean;
  inflationSetupMode?: AssumptionSetupMode;
  nbpSetupMode?: AssumptionSetupMode;
  onInflationSetupModeChange?: (mode: AssumptionSetupMode) => void;
  onNbpSetupModeChange?: (mode: AssumptionSetupMode) => void;
}

export const MarketAssumptionsForm = ({
  expectedInflation,
  expectedNbpRate,
  bondType,
  customInflation,
  customNbpRate,
  onUpdate,
  compact = false,
  inflationHorizonYears = 10,
  section = 'all',
  showIntro = true,
  inflationSetupMode,
  nbpSetupMode,
  onInflationSetupModeChange,
  onNbpSetupModeChange,
}: MarketAssumptionsFormProps) => {
  const { t } = useAppI18n();
  const isInflationIndexedBond = isInflationIndexedBondType(bondType);
  const isNbpRelevant = isFloatingNbpBondType(bondType);
  const [inflationMode, setInflationMode] = React.useState<AssumptionSetupMode>(
    customInflation ? 'advanced' : 'fixed',
  );
  const [nbpMode, setNbpMode] = React.useState<AssumptionSetupMode>(
    customNbpRate ? 'advanced' : 'fixed',
  );
  const activeInflationMode = inflationSetupMode ?? inflationMode;
  const activeNbpMode = nbpSetupMode ?? nbpMode;
  const inflationHeaderValue = getHeaderAssumptionValue({
    mode: activeInflationMode,
    customPath: customInflation,
    fallback: expectedInflation,
  });
  const nbpHeaderValue = getHeaderAssumptionValue({
    mode: activeNbpMode,
    customPath: customNbpRate,
    fallback: expectedNbpRate ?? 5.25,
  });
  const horizonLength = Math.max(1, Math.round(inflationHorizonYears));
  const showInflationSection = section === 'all' || section === 'inflation';
  const showNbpSection = section === 'all' || section === 'nbp';

  React.useEffect(() => {
    if (customInflation) {
      if (inflationSetupMode === undefined) {
        setInflationMode('advanced');
      }
      onInflationSetupModeChange?.('advanced');
    }
  }, [customInflation, inflationSetupMode, onInflationSetupModeChange]);

  React.useEffect(() => {
    if (customNbpRate) {
      if (nbpSetupMode === undefined) {
        setNbpMode('advanced');
      }
      onNbpSetupModeChange?.('advanced');
    }
  }, [customNbpRate, nbpSetupMode, onNbpSetupModeChange]);

  const updateInflationMode = (mode: AssumptionSetupMode) => {
    const update = resolveAssumptionModeUpdate({
      mode,
      horizonLength,
      currentValue: expectedInflation,
      fixedFallback: 2.5,
    });
    setInflationMode(mode);
    onInflationSetupModeChange?.(mode);
    if (update.customPath) {
      onUpdate('customInflation', update.customPath);
      return;
    }
    onUpdate('customInflation', undefined);
    if (update.fixedValue !== undefined) {
      onUpdate('expectedInflation', update.fixedValue);
    }
  };

  const updateNbpMode = (mode: AssumptionSetupMode) => {
    const baseNbp = expectedNbpRate ?? 5.25;
    const update = resolveAssumptionModeUpdate({
      mode,
      horizonLength,
      currentValue: baseNbp,
      fixedFallback: 5.25,
    });
    setNbpMode(mode);
    onNbpSetupModeChange?.(mode);
    if (update.customPath) {
      onUpdate('customNbpRate', update.customPath);
      return;
    }
    onUpdate('customNbpRate', undefined);
    if (update.fixedValue !== undefined) {
      onUpdate('expectedNbpRate', update.fixedValue);
    }
  };

  return (
    <div data-testid="market-assumptions-form" className="space-y-6">
      {showIntro ? (
        <div className="space-y-3">
          <p
            className={cn(
              'font-semibold tracking-[0.08em] text-foreground',
              compact ? 'text-xs uppercase' : 'text-sm',
            )}
          >
            {t('bonds.market_assumptions.simple_title')}
          </p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {t('bonds.market_assumptions.advanced_desc')}
          </p>
          <MacroDefaultsSummary showNbp={isNbpRelevant || section === 'nbp'} compact={compact} />
        </div>
      ) : null}

      {showInflationSection ? (
        <div className="space-y-4">
          {section === 'all' ? (
            <AssumptionSemanticsNote bondType={bondType} showNbpNote={isNbpRelevant} />
          ) : null}

          <InflationAssumptionSection
            compact={compact}
            expectedInflation={expectedInflation}
            customInflation={customInflation}
            inflationHeaderValue={inflationHeaderValue}
            activeInflationMode={activeInflationMode}
            isInflationIndexedBond={isInflationIndexedBond}
            onUpdate={onUpdate}
            onModeChange={updateInflationMode}
          />
        </div>
      ) : null}

      {showNbpSection ? (
        <NbpAssumptionSection
          compact={compact}
          section={section}
          expectedNbpRate={expectedNbpRate}
          customNbpRate={customNbpRate}
          nbpHeaderValue={nbpHeaderValue}
          activeNbpMode={activeNbpMode}
          isNbpRelevant={isNbpRelevant}
          onUpdate={onUpdate}
          onModeChange={updateNbpMode}
        />
      ) : null}
    </div>
  );
};
