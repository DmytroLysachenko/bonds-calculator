'use client';

import { ArrowRight, Clock, Coins, ShieldCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import type { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import type { CalculationDataFreshness } from '@/features/bond-core/types/scenarios';
import { useAppI18n } from '@/i18n/client';
import { OfferProvenance } from '@/shared/components/data/OfferProvenance';
import { formatBondDuration } from '@/shared/lib/format-bond-duration';

interface BondEducationCardProps {
  bond: BondDefinition;
  dataFreshness?: CalculationDataFreshness;
}

function getRateBasis(bond: BondDefinition, t: ReturnType<typeof useAppI18n>['t']) {
  if (bond.isInflationIndexed) return t('education.comparison.inflation_indexed');
  if (bond.isFloating) return t('education.comparison.reference_rate');
  return t('education.comparison.fixed_rate');
}

export function BondEducationCard({ bond, dataFreshness }: BondEducationCardProps) {
  const { t, locale } = useAppI18n();
  const hasMargin = bond.margin > 0;

  return (
    <article
      id={`bond-${bond.type}`}
      className="scroll-mt-6 border-t border-border py-6 md:scroll-mt-10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="surface-chip">{getRateBasis(bond, t)}</span>
            {bond.isFamilyOnly ? (
              <span className="surface-chip text-foreground">{t('bonds.family_only')}</span>
            ) : null}
          </div>
          <h3 className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[30px] font-semibold leading-none tracking-tight text-foreground">
              {bond.name}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {formatBondDuration(bond.duration, locale)}
            </span>
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{bond.fullName[locale]}</p>
        </div>
      </div>

      <p className="mt-5 text-base leading-6 text-foreground">{bond.description[locale]}</p>

      <div className="mt-5">
        <OfferProvenance
          dataFreshness={dataFreshness}
          rateProvenance={bond.rateProvenance}
          compact
          genericFamily
        />
      </div>
      <dl className="mt-4 divide-y divide-border border-y border-border text-base leading-6">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-3.5 text-foreground" aria-hidden="true" />
            {t('bonds.duration')}
          </dt>
          <dd className="font-mono font-semibold tabular-nums text-foreground">
            {formatBondDuration(bond.duration, locale)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Coins className="size-3.5 text-foreground" aria-hidden="true" />
            {t('bonds.payout_type')}
          </dt>
          <dd className="font-semibold text-foreground">
            {bond.isCapitalized ? t('bonds.capitalization') : t('bonds.payout')}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-3.5 text-foreground" aria-hidden="true" />
            {t('education.comparison.first_rate')}
          </dt>
          <dd className="font-mono font-semibold tabular-nums text-foreground">
            {bond.firstYearRate}%
          </dd>
        </div>
        {hasMargin ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="size-3.5 text-foreground" aria-hidden="true" />
              {t('bonds.margin')}
            </dt>
            <dd className="font-mono font-semibold tabular-nums text-foreground">{bond.margin}%</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 border-l-2 border-warning/60 bg-warning/5 px-3 py-2 text-base leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">{t('bonds.early_exit_title')}: </span>
        {t('bonds.early_exit_desc', { fee: bond.earlyWithdrawalFee })}
      </div>

      <Link
        href={`/single-calculator?bond=${bond.type}`}
        className="ui-interactive-surface mt-5 inline-flex min-h-11 items-center gap-2 border-b border-foreground text-sm font-semibold text-foreground"
      >
        {t('education.calculate_this_bond', { bond: bond.name })}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
