'use client';
import { format } from 'date-fns';
import React from 'react';

import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondInputs } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { getDateFnsLocale } from '@/i18n/locale-utils';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
import { ParameterSummary } from '@/shared/components/results/ParameterSummary';
import { getBondRateContextCopy } from '@/shared/lib/bond-rate-context';
import { formatBondDuration } from '@/shared/lib/format-bond-duration';

interface BondSummaryFooterProps {
  inputs: BondInputs;
  currentDef: BondDefinition;
  maturityDate: Date;
  hasMounted: boolean;
}
export const BondSummaryFooter: React.FC<BondSummaryFooterProps> = React.memo(
  ({ inputs, currentDef, maturityDate, hasMounted }) => {
    const { t, locale: language } = useAppI18n();
    const dateLocale = getDateFnsLocale(language);
    const rateContext = getBondRateContextCopy(
      inputs.bondType,
      Number(inputs.firstYearRate),
      Number(inputs.margin),
      t,
    );
    const summaryItems = [
      {
        label: t('bonds.bond.type'),
        value: `${inputs.bondType} - ${currentDef.fullName[language]}`,
      },
      {
        label: t('bonds.duration'),
        value: formatBondDuration(inputs.duration, language),
      },
      {
        label: rateContext.firstPeriodLabel,
        value: rateContext.firstPeriodValueLabel,
      },
      ...(currentDef.margin > 0
        ? [
            {
              label: t('bonds.margin'),
              value: `${inputs.margin}%`,
            },
          ]
        : []),
      ...(rateContext.laterPeriodsLabel
        ? [
            {
              label: t('bonds.rate_context.later_periods'),
              value: rateContext.laterPeriodsLabel,
            },
          ]
        : []),
      {
        label: t('bonds.maturity_date'),
        value: hasMounted ? format(maturityDate, 'PPP', { locale: dateLocale }) : '---',
      },
      {
        label: (
          <span className="inline-flex items-center gap-1">
            {t('bonds.payout_type')}
            <InfoTooltip content={t('bonds.glossary.capitalization')} />
          </span>
        ),
        value: inputs.isCapitalized ? t('bonds.capitalization') : t('bonds.payout'),
      },
      {
        label: (
          <span className="inline-flex items-center gap-1">
            {t('bonds.early_withdrawal_fee')}
            <InfoTooltip content={t('bonds.glossary.early_withdrawal')} />
          </span>
        ),
        value: `${inputs.earlyWithdrawalFee} PLN`,
      },
    ];
    return (
      <div className="pt-2 px-6 pb-6">
        <ParameterSummary items={summaryItems} variant="compact" />
      </div>
    );
  },
);
BondSummaryFooter.displayName = 'BondSummaryFooter';
