'use client';

import { format, type Locale, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { LazyCalendar } from '@/components/ui/lazy-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type RegularInvestmentInputs } from '@/features/bond-core/types';
import { cn } from '@/lib/utils';
import { FormField } from '@/shared/components/forms/FormField';
import { FormInlineNotice } from '@/shared/components/forms/FormInlineNotice';
import { RangeField } from '@/shared/components/forms/RangeField';
import { SegmentedControl } from '@/shared/components/forms/SegmentedControl';
import { toDateString } from '@/shared/lib/date-timing';
import { type FieldUpdater } from '@/shared/types/field-updater';

type TimingSectionProps = {
  timingMode?: 'general' | 'exact';
  purchaseDate: string;
  withdrawalDate: string;
  investmentHorizonYears: number;
  dateLocale: Locale;
  onUpdate: FieldUpdater<RegularInvestmentInputs>;
  t: (key: string) => string;
};

export function TimingSection({
  timingMode,
  purchaseDate,
  withdrawalDate,
  investmentHorizonYears,
  dateLocale,
  onUpdate,
  t,
}: TimingSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[15px] font-semibold">{t('bonds.timing.mode.label')}</p>
        <SegmentedControl
          value={timingMode ?? 'general'}
          options={[
            { value: 'general', label: t('bonds.timing.mode.general') },
            { value: 'exact', label: t('bonds.timing.mode.exact') },
          ]}
          onValueChange={(value) => onUpdate('timingMode', value)}
        />
      </div>

      <div
        className={cn(
          'grid gap-4',
          timingMode === 'exact' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1',
        )}
      >
        <FormField
          label={t('bonds.purchase_date')}
          htmlFor="regular-purchase-date"
          tooltip={t('regular_form.start_date_help')}
          labelClassName="text-muted-foreground"
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="regular-purchase-date"
                variant="outline"
                className={cn(
                  'h-11 w-full justify-start px-3 text-left text-[15px] font-normal',
                  !purchaseDate && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {purchaseDate ? (
                  format(parseISO(purchaseDate), 'PPP', { locale: dateLocale })
                ) : (
                  <span>{t('bonds.pick_date')}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <LazyCalendar
                mode="single"
                captionLayout="dropdown"
                startMonth={new Date(2010, 0)}
                endMonth={new Date(2050, 11)}
                selected={parseISO(purchaseDate)}
                onSelect={(date) => date && onUpdate('purchaseDate', toDateString(date))}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </FormField>

        {timingMode === 'exact' ? (
          <FormField
            label={t('bonds.withdrawal_date')}
            htmlFor="regular-withdrawal-date"
            tooltip={t('regular_form.withdrawal_date_help')}
            labelClassName="text-muted-foreground"
          >
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="regular-withdrawal-date"
                  variant="outline"
                  className={cn(
                    'h-11 w-full justify-start px-3 text-left text-[15px] font-normal',
                    !withdrawalDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {withdrawalDate ? (
                    format(parseISO(withdrawalDate), 'PPP', { locale: dateLocale })
                  ) : (
                    <span>{t('bonds.pick_date')}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <LazyCalendar
                  mode="single"
                  captionLayout="dropdown"
                  startMonth={new Date(2010, 0)}
                  endMonth={new Date(2050, 11)}
                  selected={parseISO(withdrawalDate)}
                  onSelect={(date) => date && onUpdate('withdrawalDate', toDateString(date))}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </FormField>
        ) : null}
      </div>

      {timingMode === 'exact' ? (
        <FormField label={t('bonds.investment_horizon')} tooltip={t('regular_form.horizon_help')}>
          <FormInlineNotice
            title={`${
              investmentHorizonYears % 1 === 0
                ? investmentHorizonYears.toFixed(0)
                : investmentHorizonYears.toFixed(2)
            } ${t('common.years')}`}
            description={t('regular_form.horizon_help')}
          />
        </FormField>
      ) : (
        <RangeField
          label={t('bonds.investment_horizon')}
          tooltip={t('regular_form.horizon_help')}
          value={investmentHorizonYears}
          min={1}
          max={30}
          step={1}
          unit="Y"
          onCommit={(value) => onUpdate('investmentHorizonMonths', value * 12)}
        />
      )}
    </div>
  );
}
