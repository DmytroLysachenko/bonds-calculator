'use client';

import React from 'react';

import { Label } from '@/components/ui/label';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/shared/components/forms/SegmentedControl';
import type { AssumptionSetupMode } from '@/shared/lib/market-assumptions-form-model';

export function ProjectionModeButtons({
  value,
  onChange,
  label,
}: {
  value: AssumptionSetupMode;
  onChange: (value: AssumptionSetupMode) => void;
  label: string;
}) {
  const { t } = useAppI18n();

  return (
    <SegmentedControl
      label={label}
      value={value}
      options={[
        { value: 'fixed', label: t('bonds.market_assumptions.mode_fixed') },
        { value: 'simple', label: t('bonds.market_assumptions.mode_simple') },
        { value: 'advanced', label: t('bonds.market_assumptions.mode_advanced') },
      ]}
      onValueChange={onChange}
      className="grid-cols-3"
      itemClassName="h-8 text-[11px] tracking-[0.06em]"
    />
  );
}

export function CurrentAssumptionValue({
  value,
  unit = '%',
  compact,
  children,
}: {
  value: number | string;
  unit?: string;
  compact: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-l border-border pl-4 text-right">
      <span
        className={cn('font-black tabular-nums text-foreground', compact ? 'text-xl' : 'text-2xl')}
      >
        {value}
        {unit}
      </span>
      {children}
    </div>
  );
}

export function AssumptionHeader({
  label,
  htmlFor,
  muted = false,
  compact,
  history,
  value,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  muted?: boolean;
  compact: boolean;
  history: React.ReactNode;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border-y border-border py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Label
            htmlFor={htmlFor}
            className={cn(
              'font-semibold tracking-[0.08em]',
              muted ? 'text-muted-foreground' : 'text-primary',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {label}
          </Label>
          {history}
        </div>
        {value}
      </div>
      {children}
    </div>
  );
}
