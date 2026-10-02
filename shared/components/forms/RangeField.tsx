'use client';

import React from 'react';

import { CommittedSliderInput } from '@/shared/components/CommittedSliderInput';

import { FormField } from './FormField';

interface RangeFieldProps {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  tooltip?: React.ReactNode;
  description?: React.ReactNode;
  valueFormatter?: (value: number) => string;
  showInput?: boolean;
  className?: string;
  onCommit: (value: number) => void;
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  tooltip,
  description,
  valueFormatter,
  showInput = true,
  className,
  onCommit,
}: RangeFieldProps) {
  return (
    <FormField label={label} tooltip={tooltip} description={description} className={className}>
      <CommittedSliderInput
        ariaLabel={typeof label === 'string' ? label : undefined}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        showInput={showInput}
        valueFormatter={valueFormatter}
        onCommit={onCommit}
      />
    </FormField>
  );
}
