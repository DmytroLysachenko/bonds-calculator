import { format, type Locale, parseISO } from 'date-fns';

import type { RegularInvestmentResult } from '@/features/bond-core/types';
import { MAX_RECENT_REGULAR_INVESTMENT_LOTS } from '@/features/regular-investment/constants/results';
import type { RegularInvestmentSummaryStat } from '@/features/regular-investment/types/results';
import type { FinancialInsightItem } from '@/shared/components/results/FinancialInsightStrip';
import type { RecentLotDisplayItem } from '@/shared/components/results/RecentLotList';
import { buildRecentRegularInvestmentLots } from '@/shared/lib/regular-investment-display';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function buildRegularInvestmentPrimaryStats({
  results,
  formatCurrency,
  t,
}: {
  results: RegularInvestmentResult;
  formatCurrency: (value: number) => string;
  t: TranslateFn;
}): RegularInvestmentSummaryStat[] {
  return [
    {
      label: t('bonds.total_invested'),
      value: formatCurrency(results.totalInvested),
      helper: t('regular_summary.total_invested_helper'),
    },
    {
      label: t('bonds.final_nominal_value'),
      value: formatCurrency(results.finalNominalValue),
      helper: t('regular_summary.final_nominal_helper'),
    },
    {
      label: t('bonds.total_net_profit'),
      value: formatCurrency(results.totalProfit),
      helper: t('regular_summary.net_profit_helper'),
    },
    {
      label: t('bonds.real_value_inflation'),
      value: formatCurrency(results.finalRealValue),
      helper: t('regular_summary.real_value_helper'),
    },
    {
      label: t('regular_summary.cash_balance'),
      value: formatCurrency(results.cashBalance),
      helper: t('regular_summary.cash_balance_helper'),
    },
    {
      label: t('regular_summary.active_holdings'),
      value: formatCurrency(results.activeHoldingsValue),
      helper: t('regular_summary.active_holdings_helper'),
    },
  ];
}

export function buildRegularInvestmentFinancialInsights({
  results,
  dataQualityFlags,
  formatCurrency,
  t,
}: {
  results: RegularInvestmentResult;
  dataQualityFlags: string[];
  formatCurrency: (value: number) => string;
  t: TranslateFn;
}): FinancialInsightItem[] {
  const grossProfit = Math.max(0, results.totalProfit + results.totalTax);
  const realValueGap = Math.max(0, results.finalNominalValue - results.finalRealValue);

  return [
    {
      label: t('financial_insights.tax_impact_label'),
      value: formatCurrency(results.totalTax),
      description: t('financial_insights.tax_impact_description', {
        grossProfit: formatCurrency(grossProfit),
        netProfit: formatCurrency(results.totalProfit),
      }),
      tone: results.totalTax > 0 ? 'warning' : 'success',
    },
    {
      label: t('financial_insights.real_value_label'),
      value: formatCurrency(results.finalRealValue),
      description: t('financial_insights.real_value_description', {
        nominalValue: formatCurrency(results.finalNominalValue),
        gap: formatCurrency(realValueGap),
      }),
      tone: realValueGap > 0 ? 'warning' : 'success',
    },
    {
      label: t('financial_insights.data_quality_label'),
      value:
        dataQualityFlags.length > 0
          ? t('financial_insights.data_quality_flags', { count: dataQualityFlags.length })
          : t('financial_insights.data_quality_clean'),
      description:
        dataQualityFlags.length > 0
          ? t('financial_insights.data_quality_description')
          : t('financial_insights.data_quality_clean_description'),
      tone: dataQualityFlags.length > 0 ? 'warning' : 'success',
    },
  ];
}

export function buildRegularInvestmentRecentLotItems({
  results,
  dateLocale,
  formatCurrency,
  t,
}: {
  results: RegularInvestmentResult;
  dateLocale: Locale;
  formatCurrency: (value: number) => string;
  t: TranslateFn;
}): RecentLotDisplayItem[] {
  return buildRecentRegularInvestmentLots(results.lots, MAX_RECENT_REGULAR_INVESTMENT_LOTS).map(
    ({ key, value: lot }) => ({
      key,
      title: format(parseISO(lot.purchaseDate), 'MMMM yyyy', { locale: dateLocale }),
      subtitle: `${t('regular_summary.matures')} ${format(parseISO(lot.maturityDate), 'MMM yyyy', {
        locale: dateLocale,
      })}`,
      value: formatCurrency(lot.netValue),
      valueLabel: t('regular_summary.net_lot_value'),
      details: [
        {
          label: t('regular_summary.invested'),
          value: formatCurrency(lot.investedAmount),
        },
        {
          label: t('regular_summary.interest'),
          value: formatCurrency(lot.accumulatedInterest),
          tone: 'positive',
        },
        {
          label: t('bonds.tax'),
          value: formatCurrency(lot.tax),
          tone: 'warning',
        },
        {
          label: t('bonds.early_withdrawal_fee'),
          value: formatCurrency(lot.earlyWithdrawalFee),
        },
      ],
    }),
  );
}
