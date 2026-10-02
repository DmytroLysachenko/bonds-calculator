'use client';
import { ArrowRight, Calculator, ExternalLink, Info, Landmark, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { BondInputs, CalculationResult } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { useCurrencyFormatter } from '@/shared/hooks/useLocalizedFormatters';
interface MathDeepDiveProps {
  results: CalculationResult;
  inputs?: Pick<BondInputs, 'margin' | 'isCapitalized'>;
  trigger?: React.ReactNode;
}
export const MathDeepDive: React.FC<MathDeepDiveProps> = ({ results, inputs, trigger }) => {
  const { t, locale: language } = useAppI18n();
  const currencyFormatter = useCurrencyFormatter(language);
  const formatCurrency = (value: number) => {
    return currencyFormatter.format(value);
  };
  const totalInterest = results.grossValue - results.initialInvestment;
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            <Info className="h-4 w-4" />
            {t('bonds.how_calculated')}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <Calculator className="h-5 w-5 text-primary" />
            {t('bonds.how_calculated')}
          </SheetTitle>
          <SheetDescription>{t('bonds.explanation_text')}</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-8 pb-8">
          {/* Step 1: Gross Value */}
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                1
              </span>
              {t('bonds.gross_value')}
            </h4>
            <div className="space-y-3 border-t border-border py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('bonds.initial_investment')}</span>
                <span className="font-mono font-bold">
                  {formatCurrency(results.initialInvestment)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('bonds.plus_interest')}</span>
                <span className="font-mono font-bold text-success">
                  +{formatCurrency(totalInterest)}
                </span>
              </div>
              <Separator className="bg-primary/10" />
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs font-black uppercase">{t('bonds.gross_value')}</span>
                <span className="text-lg font-black">{formatCurrency(results.grossValue)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic leading-relaxed pt-1">
                {t('bonds.interest_formula')}
              </p>
            </div>
          </section>

          {/* Step 2: Reductions */}
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                2
              </span>
              {t('bonds.fees_and_tax')}
            </h4>
            <div className="space-y-4 border-t border-border py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Link
                    href="/education#belka_tax"
                    className="text-muted-foreground hover:text-primary underline decoration-dotted flex items-center gap-1"
                  >
                    {t('education.concepts.belka_tax.title')}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span className="font-mono font-bold text-destructive">
                    -{formatCurrency(results.totalTax)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <Link
                    href="/education#early_redemption"
                    className="text-muted-foreground hover:text-primary underline decoration-dotted flex items-center gap-1"
                  >
                    {t('education.concepts.early_redemption.title')}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span className="font-mono font-bold text-destructive">
                    -{formatCurrency(results.totalEarlyWithdrawalFee)}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs font-black uppercase">
                  {t('bonds.total_fees_and_tax')}
                </span>
                <span className="text-lg font-semibold text-destructive">
                  -{formatCurrency(results.totalTax + results.totalEarlyWithdrawalFee)}
                </span>
              </div>
            </div>
          </section>

          {/* Step 3: Final Net */}
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                3
              </span>
              {t('bonds.net_payout')}
            </h4>
            <div className="space-y-4 border-t border-border py-5">
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('bonds.payout_calculation')}
                </p>
                <div className="rounded-lg bg-muted/35 p-3 font-mono text-[11px] leading-relaxed">
                  <span className="font-bold">{formatCurrency(results.initialInvestment)}</span>{' '}
                  (Cap) + (
                  <span className="font-bold text-success">{formatCurrency(totalInterest)}</span>{' '}
                  (Int) -{' '}
                  <span className="font-bold text-destructive">
                    {formatCurrency(results.totalTax)}
                  </span>{' '}
                  (Tax) -{' '}
                  <span className="font-bold text-destructive">
                    {formatCurrency(results.totalEarlyWithdrawalFee)}
                  </span>{' '}
                  (Fee))
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="ui-metadata text-success">{t('bonds.net_payout')}</span>
                  <p className="text-[10px] font-medium text-success/70">
                    {t('bonds.actual_cash_in_hand')}
                  </p>
                </div>
                <div className="ui-large-metric text-success">
                  {formatCurrency(results.netPayoutValue)}
                </div>
              </div>
            </div>
          </section>

          {inputs ? (
            <section className="space-y-3 border-t border-border py-4">
              <h5 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('bonds.how_interest_works')}
              </h5>
              <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
                <li>
                  {inputs.margin > 0
                    ? t('bonds.interest_indexed_desc')
                    : t('bonds.rate_context.fixed_narrative')}
                </li>
                {inputs.isCapitalized ? <li>{t('bonds.capitalization_desc')}</li> : null}
                <li>{t('bonds.belka_desc')}</li>
              </ul>
            </section>
          ) : null}

          {/* Rules & Education */}
          <div className="grid grid-cols-1 gap-4 pt-4">
            <div className="space-y-3 border-t border-border py-4">
              <h5 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Landmark className="h-3.5 w-3.5" />
                {t('bonds.rounding_rules')}
              </h5>
              <ul className="text-[11px] space-y-2 text-muted-foreground list-disc pl-4 leading-relaxed">
                <li>{t('bonds.rounding_desc')}</li>
                <li>{t('bonds.tax_rounding_desc')}</li>
              </ul>
            </div>

            <div className="space-y-3 border-t border-border py-4">
              <h5 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('education.bond_types')}
              </h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('education.disclaimer')}
              </p>
              <Button asChild variant="link" className="p-0 h-auto text-[11px] font-bold">
                <Link href="/education" className="flex items-center gap-1">
                  {t('nav.education')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
