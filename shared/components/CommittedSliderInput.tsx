'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface CommittedSliderInputProps {
  label?: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  unit?: string;
  showInput?: boolean;
  showBounds?: boolean;
  sliderClassName?: string;
  inputClassName?: string;
  valueFormatter?: (value: number) => string;
  onCommit: (value: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPrecision(value: number, step: number) {
  const decimals = `${step}`.split('.')[1]?.length ?? 0;
  return Number(value.toFixed(decimals));
}

export function CommittedSliderInput({
  label,
  ariaLabel,
  value,
  min,
  max,
  step = 1,
  disabled,
  unit,
  showInput = true,
  showBounds = true,
  sliderClassName,
  inputClassName,
  valueFormatter,
  onCommit,
}: CommittedSliderInputProps) {
  const [draftValue, setDraftValue] = React.useState(value);
  const [draftText, setDraftText] = React.useState(String(value));

  React.useEffect(() => {
    setDraftValue(value);
    setDraftText(String(value));
  }, [value]);

  const commitValue = React.useCallback(
    (nextValue: number) => {
      const normalized = toPrecision(clamp(nextValue, min, max), step);
      setDraftValue(normalized);
      setDraftText(String(normalized));
      onCommit(normalized);
    },
    [max, min, onCommit, step],
  );

  const handleInputBlur = React.useCallback(() => {
    const parsed = Number(draftText.replace(',', '.'));

    if (!Number.isFinite(parsed)) {
      setDraftText(String(draftValue));
      return;
    }

    commitValue(parsed);
  }, [commitValue, draftText, draftValue]);

  const handleSliderChange = React.useCallback(
    ([nextValue]: number[]) => {
      const normalized = toPrecision(clamp(nextValue, min, max), step);
      setDraftValue(normalized);
      setDraftText(String(normalized));
    },
    [max, min, step],
  );

  const formatDisplayValue = React.useCallback(
    (nextValue: number) => {
      if (valueFormatter) {
        return valueFormatter(nextValue);
      }

      return unit ? `${nextValue} ${unit}` : String(nextValue);
    },
    [unit, valueFormatter],
  );

  return (
    <div className="space-y-2">
      {label || showBounds ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs leading-5">
          <div className="min-w-0">
            {label ? <p className="font-semibold text-foreground">{label}</p> : null}
            {showBounds ? (
              <p className="text-muted-foreground">
                {formatDisplayValue(min)} - {formatDisplayValue(max)}
              </p>
            ) : null}
          </div>
          <p className="financial-number shrink-0 text-sm font-semibold text-foreground">
            {formatDisplayValue(draftValue)}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <Slider
          value={[draftValue]}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel ?? label ?? unit ?? 'Committed slider input'}
          onValueChange={handleSliderChange}
          onValueCommit={([nextValue]) => commitValue(nextValue)}
          className={cn('flex-1', sliderClassName)}
        />
        {showInput ? (
          <div className="relative">
            <Input
              type="number"
              inputMode={step < 1 ? 'decimal' : 'numeric'}
              autoComplete="off"
              step={step}
              min={min}
              max={max}
              disabled={disabled}
              aria-label={ariaLabel ?? label ?? unit ?? 'Slider value'}
              className={cn('h-10 w-28 pr-10 text-right text-sm font-semibold', inputClassName)}
              value={draftText}
              onChange={(event) => {
                const nextText = event.target.value;
                if (step >= 1 && !/^\d*$/.test(nextText)) return;
                setDraftText(nextText);
              }}
              onBlur={handleInputBlur}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
            />
            {unit ? (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">
                {unit}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
