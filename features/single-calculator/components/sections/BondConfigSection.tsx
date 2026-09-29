'use client';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { getBondSupportMeta, isFamilyBondType } from '@/features/bond-core/support-matrix';
import { BondInputs, BondType } from '@/features/bond-core/types';
import {
  bondQuantityFromInvestment,
  investmentFromBondQuantity,
  MAX_BOND_QUANTITY,
} from '@/features/bond-core/utils/bond-quantity';
import { useAppI18n } from '@/i18n/client';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
import { BondInfoPanel } from '@/shared/components/forms/BondInfoPanel';
import { FormSelect } from '@/shared/components/forms/FormSelect';
import { getBondRateContextCopy } from '@/shared/lib/bond-rate-context';
import { createDateFormatter, createNumberFormatter } from '@/shared/lib/formatters';
interface BondSeries {
  id: string;
  seriesCode: string;
  firstYearRate: string | number;
  baseMargin: string | number | null;
  emissionMonth: string;
}
interface BondConfigSectionProps {
  inputs: BondInputs;
  onUpdate: (key: keyof BondInputs, value: string | number | boolean | undefined) => void;
  onBondTypeChange: (type: BondType, horizonChoice: 'preserve' | 'native') => void;
  definitions: Record<BondType, BondDefinition>;
  availableSeries: BondSeries[];
  selectedSeriesId: string | null;
}
export const BondConfigSection: React.FC<BondConfigSectionProps> = React.memo(
  ({ inputs, onUpdate, onBondTypeChange, definitions, availableSeries, selectedSeriesId }) => {
    const { t, locale: language } = useAppI18n();
    const [pendingBondType, setPendingBondType] = useState<BondType | null>(null);
    const currentDef = definitions[inputs.bondType];
    const currentBondSupport = getBondSupportMeta(inputs.bondType, language);
    const rateContext = getBondRateContextCopy(
      inputs.bondType,
      Number(inputs.firstYearRate),
      Number(inputs.margin),
      t,
    );
    const formatDurationLabel = (type: BondType) =>
      `${Math.round((definitions[type]?.duration ?? 1) * 12)} ${t('common.duration_months')}`;
    const maxBondUnits = MAX_BOND_QUANTITY;
    const bondUnits = bondQuantityFromInvestment(inputs.initialInvestment);
    const purchaseValueLabel = createNumberFormatter(language).format(inputs.initialInvestment);
    const formatSeriesMonth = (value: string) =>
      createDateFormatter(language, {
        month: 'short',
        year: 'numeric',
      }).format(new Date(value));
    const handleBondUnitsChange = (value: number) => {
      if (!Number.isFinite(value)) {
        return;
      }
      // Keep invalid zero in draft state so the form can announce and focus its
      // domain-specific minimum-purchase feedback instead of silently restoring 1.
      if (value === 0) {
        onUpdate('initialInvestment', 0);
        return;
      }
      const investment = investmentFromBondQuantity(value);
      if (investment === null) return;
      onUpdate('initialInvestment', investment);
    };
    return (
      <div className="space-y-6">
        <div className="flex gap-1 border-b border-border pb-2">
          <Button
            type="button"
            variant={
              !inputs.calculatorMode || inputs.calculatorMode === 'standard' ? 'default' : 'ghost'
            }
            className="h-8 flex-1 text-sm font-medium"
            onClick={() => onUpdate('calculatorMode', 'standard')}
          >
            {t('bonds.standard_payout')}
          </Button>
          <Button
            type="button"
            variant={inputs.calculatorMode === 'reverse' ? 'default' : 'ghost'}
            className="h-8 flex-1 text-sm font-medium"
            onClick={() => onUpdate('calculatorMode', 'reverse')}
          >
            {t('bonds.reverse_target')}
          </Button>
        </div>

        {inputs.calculatorMode === 'reverse' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="savingsGoal"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                {t('bonds.target_goal_req')}
              </Label>
              <InfoTooltip content={t('bonds.glossary.savings_goal')} />
            </div>
            <div className="relative">
              <Input
                id="savingsGoal"
                name="savingsGoal"
                type="number"
                min={0}
                max={100_000_000_000}
                step={1}
                inputMode="decimal"
                autoComplete="off"
                placeholder={t('bonds.example_goal')}
                className="pl-4 pr-12"
                value={inputs.savingsGoal || ''}
                onChange={(event) => {
                  if (!event.target.value) {
                    onUpdate('savingsGoal', undefined);
                    return;
                  }
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value >= 0 && value <= 100_000_000_000) {
                    onUpdate('savingsGoal', value);
                  }
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                PLN
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="bondType" className="text-sm font-semibold">
              {t('bonds.bond.type')}
            </Label>
            {currentDef.isInflationIndexed && (
              <InfoTooltip content={t('bonds.glossary.inflation_indexed')} />
            )}
          </div>
          <FormSelect
            id="bondType"
            label=""
            className="space-y-0"
            value={inputs.bondType}
            onValueChange={(value) => setPendingBondType(value as BondType)}
            placeholder={t('bonds.select_bond_type')}
            triggerClassName="bg-card"
            options={Object.values(BondType).map((type) => ({
              value: type,
              label: type,
              meta: formatDurationLabel(type),
              description: definitions[type]?.fullName[language] || type,
              badge: isFamilyBondType(type) ? (
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                  {t('bonds.family_bond_badge')}
                </span>
              ) : null,
            }))}
          />

          {pendingBondType && pendingBondType !== inputs.bondType ? (
            <div
              role="group"
              aria-label={t('bonds.horizon_choice_title')}
              className="rounded-md border border-border bg-muted/35 p-3 text-sm"
            >
              <p className="font-semibold">
                {t('bonds.horizon_choice_title', { bond: pendingBondType })}
              </p>
              <p className="mt-1 text-muted-foreground">{t('bonds.horizon_choice_description')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onBondTypeChange(pendingBondType, 'preserve');
                    setPendingBondType(null);
                  }}
                >
                  {t('bonds.horizon_choice_preserve')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onBondTypeChange(pendingBondType, 'native');
                    setPendingBondType(null);
                  }}
                >
                  {t('bonds.horizon_choice_native', {
                    months: Math.round(definitions[pendingBondType].duration * 12),
                  })}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPendingBondType(null)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : null}

          <FormSelect
            label={t('bonds.bond.series')}
            value={selectedSeriesId || 'current'}
            onValueChange={(value) => onUpdate('selectedSeriesId', value)}
            triggerClassName="bg-muted/45"
            options={[
              {
                value: 'current',
                label: t('bonds.offer.current'),
                description: t('bonds.offer.current_description'),
              },
              ...availableSeries.map((s) => ({
                value: s.id,
                label: s.seriesCode,
                meta: formatSeriesMonth(s.emissionMonth),
                description: `${Number(s.firstYearRate).toFixed(2)}%${s.baseMargin === null ? '' : ` + ${Number(s.baseMargin).toFixed(2)}%`}`,
              })),
            ]}
          />

          <BondInfoPanel
            title={currentDef.fullName[language]}
            description={currentDef.description[language]}
            narrative={rateContext.narrative}
            supportDescription={currentBondSupport.description}
            badges={[
              { label: formatDurationLabel(inputs.bondType) },
              ...(isFamilyBondType(inputs.bondType)
                ? [{ label: t('bonds.family_bond'), tone: 'warning' as const }]
                : []),
              { label: rateContext.styleLabel },
            ]}
            notice={isFamilyBondType(inputs.bondType) ? t('bonds.family_bond_notice') : null}
          />
        </div>

        {(!inputs.calculatorMode || inputs.calculatorMode === 'standard') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="bondUnits" className="font-semibold">
                {t('bonds.bond_quantity')}
              </Label>
              <span className="text-sm font-medium text-muted-foreground">
                {purchaseValueLabel} PLN
              </span>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  id="bondUnits"
                  name="bondUnits"
                  type="number"
                  min={1}
                  max={maxBondUnits}
                  step={1}
                  inputMode="numeric"
                  autoComplete="off"
                  className="pl-4 pr-16 text-sm font-medium"
                  value={bondUnits}
                  onChange={(e) => handleBondUnitsChange(Number(e.target.value))}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  {t('bonds.units')}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs leading-5 text-muted-foreground">
                <span>{t('bonds.bond_unit_price')}</span>
                <span>{t('bonds.bond_quantity_limit', { max: maxBondUnits })}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
BondConfigSection.displayName = 'BondConfigSection';
