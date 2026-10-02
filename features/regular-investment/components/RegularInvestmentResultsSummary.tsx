'use client';
import { FileSpreadsheet } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import {
  buildRegularInvestmentFinancialInsights,
  buildRegularInvestmentPrimaryStats,
  buildRegularInvestmentRecentLotItems,
} from '@/features/regular-investment/lib/regular-investment-results-model';
import { RegularInvestmentResultsSummaryProps } from '@/features/regular-investment/types/results';
import { useAppI18n } from '@/i18n/client';
import { getDateFnsLocale } from '@/i18n/locale-utils';
import { FinancialInsightStrip } from '@/shared/components/results/FinancialInsightStrip';
import { MetricStrip } from '@/shared/components/results/MetricStrip';
import { RecentLotList } from '@/shared/components/results/RecentLotList';
import { ResultSummaryHero } from '@/shared/components/results/ResultSummaryHero';
import { ScenarioDecisionRail } from '@/shared/components/results/ScenarioDecisionRail';
import { buildLotsExportHeaders } from '@/shared/lib/export-headers';
import { createCurrencyFormatter } from '@/shared/lib/formatters';
import { buildRegularInvestmentYearBuckets } from '@/shared/lib/regular-investment-display';
import { buildLotsCsvFilename, exportLotsCsv } from '@/shared/lib/retained-exports';

import { RegularInvestmentYearlyBucketsSection } from './RegularInvestmentYearlyBucketsSection';

export const RegularInvestmentResultsSummary: React.FC<RegularInvestmentResultsSummaryProps> = ({
  results,
  inputs,
  dataQualityFlags = [],
}) => {
  const { t, locale: language } = useAppI18n();
  const dateLocale = getDateFnsLocale(language);
  const currencyFormatter = useMemo(
    () =>
      createCurrencyFormatter(language, {
        style: 'currency',
        currency: 'PLN',
        maximumFractionDigits: 0,
      }),
    [language],
  );
  const formatCurrency = useCallback(
    (value: number) => currencyFormatter.format(value),
    [currencyFormatter],
  );
  const primaryStats = useMemo(
    () => buildRegularInvestmentPrimaryStats({ results, formatCurrency, t }),
    [formatCurrency, results, t],
  );
  const financialInsightItems = useMemo(
    () =>
      buildRegularInvestmentFinancialInsights({
        results,
        dataQualityFlags,
        formatCurrency,
        t,
      }),
    [dataQualityFlags, formatCurrency, results, t],
  );
  const yearlyBuckets = useMemo(
    () => buildRegularInvestmentYearBuckets(results.lots),
    [results.lots],
  );
  const recentLotItems = useMemo(
    () =>
      buildRegularInvestmentRecentLotItems({
        results,
        dateLocale,
        formatCurrency,
        t,
      }),
    [dateLocale, formatCurrency, results, t],
  );
  const handleExport = useCallback(() => {
    exportLotsCsv({
      lots: results.lots,
      headers: buildLotsExportHeaders(t),
      language,
      fileName: buildLotsCsvFilename(),
    });
  }, [language, results.lots, t]);
  const summaryActions = useMemo(
    () => [
      {
        label: t('common.export_csv'),
        icon: <FileSpreadsheet className="h-4 w-4" />,
        onClick: handleExport,
        kind: 'csv' as const,
      },
    ],
    [handleExport, t],
  );
  return (
    <div className="ui-compact-flow">
      <ResultSummaryHero
        eyebrow={t('regular_summary.plan_eyebrow')}
        value={formatCurrency(results.finalNominalValue)}
        description={t('regular_summary.hero_description')}
        narrative={t('regular_summary.hero_narrative')}
        actions={summaryActions}
      />

      <ScenarioDecisionRail
        bondType={inputs.bondType}
        horizonLabel={`${results.timeline.length} ${t('common.duration_months')}`}
        investedLabel={formatCurrency(results.totalInvested)}
        outcomeLabel={formatCurrency(results.finalNominalValue)}
      />

      <MetricStrip
        items={primaryStats}
        columns="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
        className="ui-result-panel"
      />

      {results.mixedAllocation ? (
        <section className="ui-result-panel" aria-labelledby="allocation-results-title">
          <h2 id="allocation-results-title" className="ui-heading-sm">
            {t('regular_investment_page.allocation_title')}
          </h2>
          <p className="ui-meta mt-1 text-muted-foreground">
            {t('regular_investment_page.allocation_result_note')}
          </p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">{t('bonds.bond.type')}</th>
                <th className="text-right">{t('regular_investment_page.target_weight')}</th>
                <th className="text-right">{t('regular_investment_page.actual_weight')}</th>
              </tr>
            </thead>
            <tbody>
              {results.mixedAllocation.actualWeights.map((row) => (
                <tr key={row.bondType}>
                  <td>{row.bondType}</td>
                  <td className="text-right">{row.targetPercent.toFixed(1)}%</td>
                  <td className="text-right">{row.actualPercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ui-meta mt-3">
            {t('regular_investment_page.allocation_value')}:{' '}
            {formatCurrency(results.mixedAllocation.totalValue)} ·{' '}
            {t('regular_investment_page.residual_cash')}:{' '}
            {formatCurrency(results.mixedAllocation.residualCash)}
          </p>
          {results.mixedAllocation.cashBenchmark ? (
            <p className="ui-meta mt-1">
              {t('regular_investment_page.cash_benchmark_value')}:{' '}
              {formatCurrency(results.mixedAllocation.cashBenchmark.finalValue)}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="ui-result-panel">
        <FinancialInsightStrip
          title={t('financial_insights.title')}
          description={t('financial_insights.description')}
          items={financialInsightItems}
        />
      </section>

      <div className="ui-compact-flow">
        <RegularInvestmentYearlyBucketsSection
          yearlyBuckets={yearlyBuckets}
          formatCurrency={formatCurrency}
        />

        <RecentLotList
          title={t('regular_summary.recent_title')}
          description={t('regular_summary.recent_description')}
          note={t('regular_summary.recent_note')}
          items={recentLotItems}
          compact
          initialItemCount={5}
          showAllLabel={t('common.show_all', { count: recentLotItems.length })}
          showLessLabel={t('common.show_less')}
          className="border-y border-border py-6"
        />
      </div>
    </div>
  );
};
