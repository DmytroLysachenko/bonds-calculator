'use client';

import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InvestmentFrequency,
  RegularInvestmentInputs,
  TaxStrategy,
} from '@/features/bond-core/types';
import {
  bondQuantityFromInvestment,
  investmentFromBondQuantity,
  MAX_BOND_QUANTITY,
} from '@/features/bond-core/utils/bond-quantity';
import type { ScheduledContribution } from '@/features/bond-core/utils/engine/contribution-schedule';
import type { Language } from '@/i18n/config';
import { FormField } from '@/shared/components/forms/FormField';
import { FormSelect } from '@/shared/components/forms/FormSelect';
import { RangeField } from '@/shared/components/forms/RangeField';
import { useCurrencyFormatter, useDateFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { type FieldUpdater } from '@/shared/types/field-updater';

type ContributionPlanSectionProps = {
  contributionAmount: number;
  initialLumpSum: number;
  annualContributionIncreasePercent: number;
  oneOffContributions: Array<{ date: string; amount: number }>;
  skippedContributionDates: string[];
  contributionOverrides: Array<{ date: string; amount: number }>;
  previewRows: ScheduledContribution[];
  investmentHorizonMonths: number;
  language: Language;
  frequency: InvestmentFrequency;
  taxStrategy: TaxStrategy;
  onUpdate: FieldUpdater<RegularInvestmentInputs>;
  t: (key: string) => string;
};

export function ContributionPlanSection({
  contributionAmount,
  initialLumpSum,
  annualContributionIncreasePercent,
  oneOffContributions,
  skippedContributionDates,
  contributionOverrides,
  previewRows,
  investmentHorizonMonths,
  language,
  frequency,
  taxStrategy,
  onUpdate,
  t,
}: ContributionPlanSectionProps) {
  const [extraDate, setExtraDate] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [dateError, setDateError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const currencyFormatter = useCurrencyFormatter(language);
  const dateFormatter = useDateFormatter(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const formatDate = (value: string) => dateFormatter.format(new Date(`${value}T12:00:00Z`));
  const validate = (needsAmount: boolean, allowZero = false) => {
    const dateValid =
      /^\d{4}-\d{2}-\d{2}$/.test(extraDate) &&
      !Number.isNaN(new Date(`${extraDate}T12:00:00Z`).getTime());
    const amount = Number(extraAmount);
    const amountValid =
      !needsAmount ||
      (extraAmount.trim() !== '' &&
        Number.isFinite(amount) &&
        (allowZero ? amount >= 0 : amount > 0));
    setDateError(dateValid ? '' : t('regular_investment_page.topup_date_error'));
    setAmountError(
      amountValid
        ? ''
        : t(
            allowZero
              ? 'regular_investment_page.override_amount_error'
              : 'regular_investment_page.topup_amount_error',
          ),
    );
    return dateValid && amountValid;
  };
  const taxOptions = [
    { value: TaxStrategy.STANDARD, label: t('bonds.tax_standard') },
    { value: TaxStrategy.IKE, label: t('bonds.tax_ike') },
    { value: TaxStrategy.IKZE, label: t('bonds.tax_ikze') },
  ];
  const frequencyOptions = Object.values(InvestmentFrequency).map((freq) => ({
    value: freq,
    label: t(`bonds.frequency.${freq.toLowerCase()}`),
  }));
  const firstContribution = previewRows[0];
  const lastContribution = previewRows.at(-1);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">{t('bonds.tax_strategy')}</p>
          <Badge variant="secondary" className="text-[11px] font-medium">
            {t('comparison.configuration')}
          </Badge>
        </div>
        <FormSelect
          label={t('bonds.tax_strategy')}
          value={taxStrategy}
          options={taxOptions}
          tooltip={t('bonds.tax_strategy')}
          onValueChange={(value) => onUpdate('taxStrategy', value as TaxStrategy)}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <FormField
              label={t('bonds.bond_quantity')}
              htmlFor="contributionAmount"
              tooltip={t('regular_form.contribution_help')}
            >
              <Input
                id="contributionAmount"
                type="number"
                min={1}
                max={MAX_BOND_QUANTITY}
                step={1}
                inputMode="numeric"
                value={bondQuantityFromInvestment(contributionAmount)}
                onChange={(event) => {
                  const investment = investmentFromBondQuantity(Number(event.target.value));
                  if (investment !== null) onUpdate('contributionAmount', investment);
                }}
              />
            </FormField>
            <div className="ui-field-stack">
              <p className="text-sm font-medium text-foreground">
                {t('regular_investment_page.equivalent_pln')}
              </p>
              <output
                htmlFor="contributionAmount"
                aria-label={t('regular_investment_page.equivalent_pln')}
                className="flex h-11 items-center border-b border-border font-mono text-lg font-semibold tabular-nums text-foreground"
              >
                {currencyFormatter.format(contributionAmount)}
              </output>
            </div>
          </div>
          <details className="border-b border-border pb-3">
            <summary className="ui-focus-ring min-h-11 cursor-pointer py-2 text-sm font-semibold text-foreground">
              {t('regular_investment_page.fine_tune_quantity')}
            </summary>
            <RangeField
              label={t('regular_investment_page.fine_tune_quantity')}
              value={bondQuantityFromInvestment(contributionAmount)}
              min={1}
              max={MAX_BOND_QUANTITY}
              step={1}
              unit={t('bonds.units')}
              showInput={false}
              onCommit={(value) => {
                const investment = investmentFromBondQuantity(value);
                if (investment !== null) onUpdate('contributionAmount', investment);
              }}
            />
          </details>
        </div>

        <FormSelect
          id="frequency"
          label={t('bonds.frequency.label')}
          value={frequency}
          options={frequencyOptions}
          tooltip={t('regular_form.frequency_help')}
          onValueChange={(value) => onUpdate('frequency', value as InvestmentFrequency)}
        />
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-[15px] font-semibold">{t('regular_investment_page.plan_summary')}</h3>
          <dl
            data-testid="regular-plan-summary"
            className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"
          >
            <div>
              <dt className="text-muted-foreground">
                {t('regular_investment_page.base_per_payment')}
              </dt>
              <dd className="font-semibold text-foreground">
                {currencyFormatter.format(contributionAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('bonds.investment_horizon')}</dt>
              <dd className="font-semibold text-foreground">
                {investmentHorizonMonths} {t('regular_investment_page.months_unit')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('regular_investment_page.cash_flow_count')}
              </dt>
              <dd className="font-semibold text-foreground">{previewRows.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('regular_investment_page.schedule_range')}
              </dt>
              <dd className="font-semibold text-foreground">
                {firstContribution && lastContribution
                  ? `${formatDate(firstContribution.date)} – ${formatDate(lastContribution.date)}`
                  : t('common.unavailable')}
              </dd>
            </div>
          </dl>
        </div>
        <details
          className="border-t border-border pt-4"
          onToggle={(event) => setScheduleOpen(event.currentTarget.open)}
        >
          <summary className="ui-focus-ring min-h-11 cursor-pointer py-2 text-[15px] font-semibold text-foreground">
            {t('regular_investment_page.schedule_details')}
          </summary>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('regular_investment_page.schedule_details_help')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label={t('regular_investment_page.initial_lump_sum')}
                htmlFor="initialLumpSum"
              >
                <Input
                  id="initialLumpSum"
                  type="number"
                  min={0}
                  value={initialLumpSum}
                  onChange={(event) => onUpdate('initialLumpSum', Number(event.target.value))}
                />
              </FormField>
              <FormField
                label={t('regular_investment_page.annual_increase')}
                htmlFor="annualIncrease"
              >
                <Input
                  id="annualIncrease"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={annualContributionIncreasePercent}
                  onChange={(event) =>
                    onUpdate('annualContributionIncreasePercent', Number(event.target.value))
                  }
                />
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label={t('regular_investment_page.topup_date')}
                htmlFor="schedule-extra-date"
                description={t('regular_investment_page.date_format_hint')}
                error={dateError}
              >
                <Input
                  id="schedule-extra-date"
                  lang={language}
                  type="date"
                  value={extraDate}
                  onChange={(event) => {
                    setExtraDate(event.target.value);
                    setDateError('');
                  }}
                />
              </FormField>
              <FormField
                label={t('regular_investment_page.topup_amount')}
                htmlFor="schedule-extra-amount"
                description={t('regular_investment_page.amount_hint')}
                error={amountError}
              >
                <Input
                  id="schedule-extra-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={extraAmount}
                  onChange={(event) => {
                    setExtraAmount(event.target.value);
                    setAmountError('');
                  }}
                />
              </FormField>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-2 border-l-2 border-border pl-3">
                <p className="text-sm text-muted-foreground">
                  {t('regular_investment_page.add_topup_help')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (validate(true)) {
                      onUpdate('oneOffContributions', [
                        ...oneOffContributions,
                        { date: extraDate, amount: Number(extraAmount) },
                      ]);
                      setExtraDate('');
                      setExtraAmount('');
                    }
                  }}
                >
                  {t('regular_investment_page.add_topup')}
                </Button>
              </div>
              <div className="space-y-2 border-l-2 border-border pl-3">
                <p className="text-sm text-muted-foreground">
                  {t('regular_investment_page.skip_date_help')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (validate(false))
                      onUpdate('skippedContributionDates', [
                        ...skippedContributionDates,
                        extraDate,
                      ]);
                  }}
                >
                  {t('regular_investment_page.skip_date')}
                </Button>
              </div>
              <div className="space-y-2 border-l-2 border-border pl-3">
                <p className="text-sm text-muted-foreground">
                  {t('regular_investment_page.override_date_help')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (validate(true, true))
                      onUpdate('contributionOverrides', [
                        ...contributionOverrides.filter((item) => item.date !== extraDate),
                        { date: extraDate, amount: Number(extraAmount) },
                      ]);
                  }}
                >
                  {t('regular_investment_page.override_date')}
                </Button>
              </div>
            </div>
            {oneOffContributions.length || skippedContributionDates.length ? (
              <ul className="ui-meta space-y-1">
                {oneOffContributions.map((item, index) => (
                  <li key={`${item.date}-${index}`}>
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        onUpdate(
                          'oneOffContributions',
                          oneOffContributions.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      {formatDate(item.date)}: {currencyFormatter.format(item.amount)} ×
                    </button>
                  </li>
                ))}
                {skippedContributionDates.map((date) => (
                  <li key={date}>
                    {formatDate(date)} — {t('regular_investment_page.skip_date')}
                  </li>
                ))}
              </ul>
            ) : null}
            {scheduleOpen ? (
              <div className="max-h-80 overflow-auto border-t border-border pt-2">
                <table className="w-full text-left text-sm">
                  <caption className="mb-1 text-left text-muted-foreground">
                    {t('regular_investment_page.schedule_preview')}
                  </caption>
                  <thead>
                    <tr>
                      <th>{t('regular_investment_page.topup_date')}</th>
                      <th>{t('regular_investment_page.topup_amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={`${row.date}-${row.kind}`}>
                        <td>{formatDate(row.date)}</td>
                        <td>{currencyFormatter.format(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
