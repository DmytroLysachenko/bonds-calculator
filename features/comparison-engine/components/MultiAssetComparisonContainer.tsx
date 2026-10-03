'use client';
import { LineChart } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useMemo, useState } from 'react';

import { useAppI18n } from '@/i18n/client';
import { RecalculateButton } from '@/shared/components/feedback/RecalculateButton';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { SecondaryInsightAccordion } from '@/shared/components/results/SecondaryInsightAccordion';
import { useCurrencyFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { isCalculatorInputEnter } from '@/shared/lib/calculator-keyboard-submit';

import { useMultiAssetComparison } from '../hooks/useMultiAssetComparison';

import { ComparisonAssetBreakdown } from './ComparisonAssetBreakdown';
import { ComparisonControls } from './ComparisonControls';
import {
  computeMultiAssetTotalInvested,
  createMultiAssetAvailabilitySummary,
  createMultiAssetChartData,
  createMultiAssetEndingSnapshot,
} from './multi-asset-chart-model';
import {
  MultiAssetHistoryStatePanel,
  MultiAssetMetricsSnapshot,
  MultiAssetReadyStatePanel,
} from './MultiAssetComparisonPanels';

const MultiAssetComparisonChart = dynamic(
  () => import('./MultiAssetComparisonChart').then((module) => module.MultiAssetComparisonChart),
  {
    loading: () => (
      <div className="h-[420px] w-full animate-pulse rounded-lg bg-muted" role="status" />
    ),
  },
);

export const MultiAssetComparisonContainer = () => {
  const {
    initialSum,
    updateInitialSum,
    monthlyContribution,
    updateMonthlyContribution,
    assets,
    startYear,
    updateStartYear,
    startMonth,
    updateStartMonth,
    years,
    months,
    showRealValue,
    updateShowRealValue,
    isDirty,
    recalculate,
    historyData,
    historyAsOfLabel,
    historyCoverageLabel,
    purchasingPowerLoss,
    historySourceLabel,
    usedFallbackHistory,
    historySeriesAvailability,
    historyCoverageGaps,
    priceIndexIsApproximate,
    historyReplayIssue,
    historyCurrencyBasis,
    historyObservationBasis,
    committedScenario,
  } = useMultiAssetComparison();
  const { locale: language, t } = useAppI18n();
  const [isCalculating, setIsCalculating] = useState(false);
  const currencyFormatter = useCurrencyFormatter(language, {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  });
  const handleRecalculate = () => {
    setIsCalculating(true);
    recalculate();
    setTimeout(() => setIsCalculating(false), 250);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isCalculatorInputEnter(event) && isDirty) {
      handleRecalculate();
    }
  };
  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const totalInvested = useMemo(
    () =>
      computeMultiAssetTotalInvested({
        initialSum: committedScenario.initialSum,
        monthlyContribution: committedScenario.monthlyContribution,
        periods: assets[0]?.series.length ?? 0,
      }),
    [assets, committedScenario.initialSum, committedScenario.monthlyContribution],
  );
  const chartData = useMemo(
    () => createMultiAssetChartData({ assets, historyData, showRealValue }),
    [assets, historyData, showRealValue],
  );
  const availabilitySummary = createMultiAssetAvailabilitySummary({
    availability: historySeriesAvailability,
    labels: {
      gold: t('multi_asset_page.series.gold'),
      inflation: t('multi_asset_page.series.inflation'),
    },
  });
  const endingSnapshot = useMemo(
    () => createMultiAssetEndingSnapshot({ assets, showRealValue }),
    [assets, showRealValue],
  );
  const leadingAsset = endingSnapshot[0];
  return (
    <CalculatorPageShell
      title={t('nav.multi_asset')}
      description={t('comparison.market_vs_bonds_desc')}
      icon={<LineChart className="h-8 w-8" />}
      isCalculating={isCalculating}
      isDirty={isDirty}
      hasResults={assets.length > 0 && assets[0].series.length > 0}
      onKeyDown={handleKeyDown}
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <aside className="xl:col-span-4 xl:sticky xl:top-28 xl:h-fit">
          <ComparisonControls
            initialSum={initialSum}
            updateInitialSum={updateInitialSum}
            monthlyContribution={monthlyContribution}
            updateMonthlyContribution={updateMonthlyContribution}
            startYear={startYear}
            updateStartYear={updateStartYear}
            startMonth={startMonth}
            updateStartMonth={updateStartMonth}
            years={years}
            months={months}
            showRealValue={showRealValue}
            updateShowRealValue={updateShowRealValue}
            purchasingPowerLoss={purchasingPowerLoss}
            formatCurrency={formatCurrency}
          />
        </aside>

        <section className="space-y-6 xl:col-span-8">
          <MultiAssetHistoryStatePanel
            usedFallbackHistory={usedFallbackHistory}
            historyCoverageLabel={historyCoverageLabel}
            historySourceLabel={historySourceLabel}
            historyAsOfLabel={historyAsOfLabel}
            availabilitySummary={availabilitySummary}
            coverageGaps={historyCoverageGaps}
            priceIndexIsApproximate={priceIndexIsApproximate}
            replayIssue={historyReplayIssue}
            currencyBasis={historyCurrencyBasis}
            observationBasis={historyObservationBasis}
            showRealValue={showRealValue}
            t={t}
          />

          {assets.length > 0 && leadingAsset ? (
            <MultiAssetMetricsSnapshot
              startYear={committedScenario.startYear}
              startMonth={committedScenario.startMonth}
              totalInvested={totalInvested}
              leadingAsset={leadingAsset}
              showRealValue={showRealValue}
              formatCurrency={formatCurrency}
              t={t}
            />
          ) : null}

          {isDirty ? (
            <div className="ui-inline-notice border-l-2 border-warning text-foreground">
              {t('multi_asset_page.stale_results')}
            </div>
          ) : null}

          {assets.length > 0 && assets[0]?.series.length > 0 ? (
            <>
              <MultiAssetComparisonChart
                chartData={chartData}
                assets={assets}
                showRealValue={showRealValue}
                formatCurrency={formatCurrency}
              />

              <ComparisonAssetBreakdown
                assets={assets}
                totalInvested={totalInvested}
                showRealValue={showRealValue}
                formatCurrency={formatCurrency}
                language={language as 'en' | 'pl'}
              />
            </>
          ) : (
            <MultiAssetReadyStatePanel t={t} />
          )}

          <SecondaryInsightAccordion
            title={t('multi_asset_page.scope_notes.title')}
            description={t('multi_asset_page.scope_notes.description')}
            badge={t('multi_asset_page.scope_notes.badge')}
          >
            <div className="divide-y divide-dashed divide-border text-sm leading-6 text-muted-foreground">
              <div className="px-4 py-3">
                {t('multi_asset_page.scope_notes.cards.reference_run')}
              </div>
              <div className="px-4 py-3">{t('multi_asset_page.scope_notes.cards.start_month')}</div>
              <div className="px-4 py-3">{t('multi_asset_page.scope_notes.cards.real_value')}</div>
            </div>
          </SecondaryInsightAccordion>
        </section>
      </div>

      <RecalculateButton isDirty={isDirty} loading={isCalculating} onClick={handleRecalculate} />
    </CalculatorPageShell>
  );
};
