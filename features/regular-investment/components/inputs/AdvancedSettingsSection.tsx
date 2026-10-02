'use client';

import React, { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { RegularInvestmentInputs } from '@/features/bond-core/types';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
import { AdvancedAssumptionsDisclosure } from '@/shared/components/forms/AdvancedAssumptionsDisclosure';
import { FormInlineNotice } from '@/shared/components/forms/FormInlineNotice';
import { DeferredMarketAssumptionsForm } from '@/shared/components/market-assumptions/DeferredMarketAssumptionsForm';
import { type FieldUpdater } from '@/shared/types/field-updater';

type AdvancedSettingsSectionProps = {
  inputs: RegularInvestmentInputs;
  currentDef: BondDefinition;
  showCustomTax: boolean;
  onShowCustomTaxChange: (value: boolean) => void;
  onUpdate: FieldUpdater<RegularInvestmentInputs>;
  t: (key: string) => string;
};

export function AdvancedSettingsSection({
  inputs,
  currentDef,
  showCustomTax,
  onShowCustomTaxChange,
  onUpdate,
  t,
}: AdvancedSettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section>
      <AdvancedAssumptionsDisclosure
        title={t('common.advanced')}
        description={t('bonds.form.advanced_desc')}
        onOpenChange={setIsOpen}
      >
        {isOpen ? (
          <DeferredMarketAssumptionsForm
            expectedInflation={inputs.expectedInflation}
            expectedNbpRate={inputs.expectedNbpRate}
            bondType={inputs.bondType}
            customInflation={inputs.customInflation}
            customNbpRate={inputs.customNbpRate}
            inflationHorizonYears={Math.max(1, Math.ceil(inputs.investmentHorizonMonths / 12))}
            onUpdate={onUpdate}
            compact
          />
        ) : null}

        {currentDef.rebuyDiscount > 0 ? (
          <div className="space-y-4 border-t border-border pt-6">
            <FormInlineNotice
              tone="success"
              title={
                <span className="inline-flex items-center gap-2">
                  {t('bonds.is_rebought')}
                  <InfoTooltip content={t('regular_form.rebuy_help')} />
                </span>
              }
              description={`${t('bonds.is_rebought_desc')} (-${currentDef.rebuyDiscount.toFixed(2)} PLN/szt)`}
              action={
                <Switch
                  aria-label={t('bonds.is_rebought')}
                  checked={inputs.isRebought}
                  onCheckedChange={(checked) => onUpdate('isRebought', checked)}
                />
              }
            />
          </div>
        ) : null}

        <div className="space-y-4 border-t border-border pt-6">
          <FormInlineNotice
            title={t('bonds.reinvest')}
            description={t('bonds.rollover_desc')}
            action={
              <Switch
                aria-label={t('bonds.reinvest')}
                checked={!!inputs.rollover}
                onCheckedChange={(checked) => onUpdate('rollover', checked)}
              />
            }
          />

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="regular-custom-tax-toggle" className="text-sm font-semibold">
                  {t('bonds.custom_tax_rate')}
                </Label>
                <InfoTooltip content={t('regular_form.tax_help')} />
              </div>
              <p className="text-base leading-6 text-muted-foreground">
                {t('bonds.belka_tax_desc')}
              </p>
            </div>
            <Switch
              id="regular-custom-tax-toggle"
              checked={showCustomTax}
              onCheckedChange={onShowCustomTaxChange}
            />
          </div>

          {showCustomTax ? (
            <div className="space-y-2">
              <Label htmlFor="taxRate" className="text-sm font-semibold text-muted-foreground">
                {t('bonds.tax_rate')} (%)
              </Label>
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                inputMode="decimal"
                className="h-10"
                value={inputs.taxRate}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value >= 0 && value <= 100) {
                    onUpdate('taxRate', value);
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      </AdvancedAssumptionsDisclosure>
    </section>
  );
}
