'use client';

import { format, parseISO } from 'date-fns';
import { History } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LazyCalendar } from '@/components/ui/lazy-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BondType, TaxStrategy } from '@/features/bond-core/types';
import { IndependentBondComparisonPayload } from '@/features/bond-core/types/scenarios';
import {
  bondQuantityFromInvestment,
  investmentFromBondQuantity,
  MAX_BOND_QUANTITY,
} from '@/features/bond-core/utils/bond-quantity';
import { useAppI18n } from '@/i18n/client';
import { getDateFnsLocale } from '@/i18n/locale-utils';
import { cn } from '@/lib/utils';
import { CommittedSliderInput } from '@/shared/components/CommittedSliderInput';
import { FormSelect } from '@/shared/components/forms/FormSelect';
import { AssumptionSemanticsNote } from '@/shared/components/market-assumptions/AssumptionSemanticsNote';
import { MacroDefaultsSummary } from '@/shared/components/market-assumptions/MacroDefaultsSummary';
import { MarketAssumptionsForm } from '@/shared/components/MarketAssumptionsForm';
import { SecondaryInsightAccordion } from '@/shared/components/results/SecondaryInsightAccordion';
import { useNumberFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { toDateString } from '@/shared/lib/date-timing';
import { type FieldUpdater } from '@/shared/types/field-updater';

type SharedConfig = IndependentBondComparisonPayload['sharedConfig'];

export interface ComparisonSharedBaseCardProps {
  sharedConfig: SharedConfig;
  onUpdateSharedConfig: FieldUpdater<SharedConfig>;
}

export function ComparisonSharedBaseCard({
  sharedConfig,
  onUpdateSharedConfig,
}: ComparisonSharedBaseCardProps) {
  const { t, locale: language } = useAppI18n();
  const dateLocale = getDateFnsLocale(language);
  const numberFormatter = useNumberFormatter(language);

  return (
    <section className="space-y-6 border-l-2 border-t border-border px-4 py-4 sm:px-5">
      <div className="space-y-2 border-b border-border pb-4">
        <h2 className="ui-section-title">{t('comparison.shared_base_title')}</h2>
        <p className="ui-body text-muted-foreground">{t('comparison.shared_base_desc')}</p>
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="comparison-maturity-mode" className="ui-metadata text-muted-foreground">
            {t('comparison.maturity_policy')}
          </Label>
          <FormSelect
            id="comparison-maturity-mode"
            value={sharedConfig.strategyPolicy ?? 'reinvest_until_horizon'}
            options={[
              { value: 'reinvest_until_horizon', label: t('comparison.maturity_reinvest') },
              { value: 'cash_after_maturity', label: t('comparison.maturity_cash') },
              { value: 'hold_to_maturity', label: t('comparison.maturity_hold') },
            ]}
            onValueChange={(value) =>
              onUpdateSharedConfig('strategyPolicy', value as SharedConfig['strategyPolicy'])
            }
          />
          <p className="text-base leading-6 text-muted-foreground">
            {t('comparison.maturity_cash_note')}
          </p>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="comparison-coupon-disposition"
            className="ui-metadata text-muted-foreground"
          >
            {t('comparison.coupon_policy')}
          </Label>
          <FormSelect
            id="comparison-coupon-disposition"
            value={sharedConfig.couponDisposition ?? 'reinvest'}
            options={[
              { value: 'reinvest', label: t('comparison.coupon_reinvest') },
              { value: 'cash', label: t('comparison.coupon_cash') },
            ]}
            onValueChange={(value) =>
              onUpdateSharedConfig('couponDisposition', value as SharedConfig['couponDisposition'])
            }
          />
        </div>
        <div className="space-y-3">
          <Label className="ui-metadata text-muted-foreground">
            {t('bonds.timing.mode.label')}
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={
                !sharedConfig.timingMode || sharedConfig.timingMode === 'general'
                  ? 'default'
                  : 'outline'
              }
              className="h-11 flex-1 text-xs font-semibold"
              onClick={() => onUpdateSharedConfig('timingMode', 'general')}
            >
              {t('bonds.timing.mode.general')}
            </Button>
            <Button
              type="button"
              variant={sharedConfig.timingMode === 'exact' ? 'default' : 'outline'}
              className="h-11 flex-1 text-xs font-semibold"
              onClick={() => onUpdateSharedConfig('timingMode', 'exact')}
            >
              {t('bonds.timing.mode.exact')}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="comparison-initial-investment"
            className="ui-metadata text-muted-foreground"
          >
            {t('bonds.bond_quantity')}
          </Label>
          <p className="ui-metadata text-muted-foreground">
            {numberFormatter.format(sharedConfig.initialInvestment)} PLN
          </p>
          <div className="relative">
            <Input
              type="number"
              id="comparison-initial-investment"
              name="comparison-initial-investment"
              min={1}
              max={MAX_BOND_QUANTITY}
              step={1}
              inputMode="numeric"
              className="h-11 rounded-lg pr-12 text-lg font-semibold"
              value={bondQuantityFromInvestment(sharedConfig.initialInvestment)}
              onChange={(event) => {
                const investment = investmentFromBondQuantity(Number(event.target.value));
                if (investment !== null) onUpdateSharedConfig('initialInvestment', investment);
              }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 ui-metadata text-muted-foreground">
              {t('bonds.units')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-dashed pt-4">
          <div className="space-y-2">
            <Label className="ui-metadata text-muted-foreground">{t('bonds.purchase_date')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  aria-label={`${t('bonds.purchase_date')}: ${
                    sharedConfig.purchaseDate
                      ? format(parseISO(sharedConfig.purchaseDate), 'PPP', { locale: dateLocale })
                      : t('common.not_available')
                  }`}
                  className={cn(
                    'h-11 w-full justify-start text-left font-semibold',
                    !sharedConfig.purchaseDate && 'text-muted-foreground',
                  )}
                >
                  <History className="mr-2 h-4 w-4 text-primary" />
                  {sharedConfig.purchaseDate ? (
                    format(parseISO(sharedConfig.purchaseDate), 'PPP', {
                      locale: getDateFnsLocale(language),
                    })
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
                  selected={parseISO(sharedConfig.purchaseDate)}
                  onSelect={(date) =>
                    date && onUpdateSharedConfig('purchaseDate', toDateString(date))
                  }
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {sharedConfig.timingMode === 'exact' ? (
            <div className="space-y-2">
              <Label className="ui-metadata text-muted-foreground">
                {t('bonds.withdrawal_date')}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    aria-label={t('bonds.withdrawal_date')}
                    className={cn(
                      'h-11 w-full justify-start text-left font-semibold',
                      !sharedConfig.withdrawalDate && 'text-muted-foreground',
                    )}
                  >
                    <History className="mr-2 h-4 w-4 text-primary" />
                    {sharedConfig.withdrawalDate ? (
                      format(parseISO(sharedConfig.withdrawalDate), 'PPP', {
                        locale: getDateFnsLocale(language),
                      })
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
                    selected={parseISO(sharedConfig.withdrawalDate)}
                    onSelect={(date) =>
                      date && onUpdateSharedConfig('withdrawalDate', toDateString(date))
                    }
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 border-t border-dashed pt-4">
          <Label className="ui-metadata text-muted-foreground">
            {t('bonds.investment_horizon')}
          </Label>
          <CommittedSliderInput
            value={sharedConfig.investmentHorizonMonths ?? 120}
            min={12}
            max={360}
            step={1}
            unit={t('common.month_compact')}
            onCommit={(value) => onUpdateSharedConfig('investmentHorizonMonths', value)}
          />
          <p className="text-base leading-7 text-muted-foreground">
            {t('comparison.shared_horizon_desc')}
          </p>
        </div>
      </div>
    </section>
  );
}

interface ComparisonSharedAssumptionsPanelProps extends ComparisonSharedBaseCardProps {
  assumptionsBondType: BondType;
}

export function ComparisonSharedAssumptionsPanel({
  sharedConfig,
  assumptionsBondType,
  onUpdateSharedConfig,
}: ComparisonSharedAssumptionsPanelProps) {
  const { t } = useAppI18n();

  return (
    <section className="ui-plan-region space-y-6 px-5 py-6 md:px-6 md:py-7">
      <div className="max-w-3xl space-y-2">
        <p className="ui-kicker">{t('comparison.shared_assumptions_title')}</p>
        <p className="ui-body text-muted-foreground">{t('comparison.shared_assumptions_desc')}</p>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,20rem)] xl:divide-x xl:divide-y-0">
        <section className="min-w-0 py-3 xl:pr-6">
          <MarketAssumptionsForm
            expectedInflation={sharedConfig.expectedInflation}
            expectedNbpRate={sharedConfig.expectedNbpRate}
            customInflation={sharedConfig.customInflation}
            customNbpRate={sharedConfig.customNbpRate}
            bondType={assumptionsBondType}
            inflationHorizonYears={Math.max(
              1,
              Math.ceil((sharedConfig.investmentHorizonMonths ?? 120) / 12),
            )}
            onUpdate={onUpdateSharedConfig}
            compact
            section="inflation"
            showIntro={false}
          />
        </section>

        <section className="min-w-0 py-3 xl:px-6">
          <MarketAssumptionsForm
            expectedInflation={sharedConfig.expectedInflation}
            expectedNbpRate={sharedConfig.expectedNbpRate}
            customInflation={sharedConfig.customInflation}
            customNbpRate={sharedConfig.customNbpRate}
            bondType={assumptionsBondType}
            inflationHorizonYears={Math.max(
              1,
              Math.ceil((sharedConfig.investmentHorizonMonths ?? 120) / 12),
            )}
            onUpdate={onUpdateSharedConfig}
            compact
            section="nbp"
            showIntro={false}
          />
        </section>

        <section className="space-y-3 py-3 xl:pl-6">
          <FormSelect
            label={t('bonds.tax_strategy')}
            value={sharedConfig.taxStrategy ?? TaxStrategy.STANDARD}
            onValueChange={(value) => onUpdateSharedConfig('taxStrategy', value as TaxStrategy)}
            options={[
              { value: TaxStrategy.STANDARD, label: t('bonds.tax_standard') },
              { value: TaxStrategy.IKE, label: t('bonds.tax_ike') },
              { value: TaxStrategy.IKZE, label: t('bonds.tax_ikze') },
            ]}
          />
          <p className="text-base leading-7 text-muted-foreground">
            {t('comparison.shared_tax_desc')}
          </p>
        </section>
      </div>

      <AssumptionSemanticsNote bondType={assumptionsBondType} className="border-solid pt-5" />

      <SecondaryInsightAccordion
        title={t('bonds.market_assumptions.source_title')}
        description={t('bonds.market_assumptions.source_description')}
        badge={t('comparison.helper_secondary')}
        className="ui-plan-assumptions"
      >
        <MacroDefaultsSummary showNbp compact />
      </SecondaryInsightAccordion>
    </section>
  );
}
