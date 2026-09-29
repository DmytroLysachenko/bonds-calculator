'use client';

import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { getBondSupportMeta, isFamilyBondType } from '@/features/bond-core/support-matrix';
import { BondType } from '@/features/bond-core/types';
import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
import { BondInfoPanel } from '@/shared/components/forms/BondInfoPanel';
import { FormSelect } from '@/shared/components/forms/FormSelect';

type BondSelectionSectionProps = {
  bondType: BondType;
  definitions: Record<BondType, BondDefinition>;
  language: 'en' | 'pl';
  onBondTypeChange: (value: BondType, horizonChoice: 'preserve' | 'native') => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function BondSelectionSection({
  bondType,
  definitions,
  language,
  onBondTypeChange,
  t,
}: BondSelectionSectionProps) {
  const currentDef = definitions[bondType];
  const currentBondSupport = getBondSupportMeta(bondType, language);
  const [pendingBondType, setPendingBondType] = useState<BondType | null>(null);
  const preserveButtonRef = useRef<HTMLButtonElement>(null);
  const previousPendingBondType = useRef<BondType | null>(null);

  useEffect(() => {
    if (pendingBondType && pendingBondType !== bondType) {
      // Radix restores focus to the Select trigger after its menu closes.
      const timer = window.setTimeout(() => preserveButtonRef.current?.focus(), 200);
      previousPendingBondType.current = pendingBondType;
      return () => window.clearTimeout(timer);
    }
    if (previousPendingBondType.current && !pendingBondType) {
      document.getElementById('bondType')?.focus();
    }
    previousPendingBondType.current = pendingBondType;
  }, [bondType, pendingBondType]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="bondType" className="text-[15px] font-semibold">
            {t('bonds.bond.type')}
          </Label>
          <InfoTooltip content={t('bonds.bond.type_selection')} />
        </div>
        <FormSelect
          id="bondType"
          value={bondType}
          onValueChange={(value) => setPendingBondType(value as BondType)}
          placeholder={t('bonds.select_bond_type')}
          options={Object.values(BondType).map((type) => ({
            value: type,
            label: type,
            description: definitions[type]?.fullName[language] || type,
            badge: (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]',
                  getBondSupportMeta(type, language).tone === 'caution'
                    ? 'bg-warning/10 text-warning'
                    : getBondSupportMeta(type, language).tone === 'limited'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-success/10 text-success',
                )}
              >
                {getBondSupportMeta(type, language).shortLabel}
              </span>
            ),
          }))}
        />

        {pendingBondType && pendingBondType !== bondType ? (
          <div
            role="group"
            aria-label={t('bonds.horizon_choice_title', { bond: pendingBondType })}
            className="rounded-md border border-border bg-muted/35 p-3 text-sm"
          >
            <p className="font-semibold">
              {t('bonds.horizon_choice_title', { bond: pendingBondType })}
            </p>
            <p className="mt-1 text-muted-foreground">{t('bonds.horizon_choice_description')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                ref={preserveButtonRef}
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

        <BondInfoPanel
          title={currentDef.fullName[language]}
          description={currentDef.description[language]}
          supportDescription={currentBondSupport.description}
          notice={isFamilyBondType(bondType) ? t('regular_investment_page.family_bond_note') : null}
        />
      </div>
    </div>
  );
}
