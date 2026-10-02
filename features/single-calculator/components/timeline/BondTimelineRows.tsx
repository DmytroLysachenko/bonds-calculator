'use client';

import { BondTimelineRowsProps } from '@/features/single-calculator/types/timeline';
import { useAppI18n } from '@/i18n/client';

import { BondTimelineDesktopRows } from './BondTimelineDesktopRows';
import { BondTimelineMobileRows } from './BondTimelineMobileRows';

export function BondTimelineRows({
  mobileResultsId,
  desktopResultsId,
  displayedTimeline,
  filteredTimelineLength,
  activeFilterCount,
  rowLimit,
  onRowLimitChange,
  onResetFilters,
  formatCurrency,
}: BondTimelineRowsProps) {
  const { t } = useAppI18n();
  const firstCashFlowLabel = displayedTimeline[0]?.cashFlowLabel ?? t('bonds.schedule.cash_flow');

  return (
    <>
      <BondTimelineMobileRows
        resultsId={mobileResultsId}
        displayedTimeline={displayedTimeline}
        filteredTimelineLength={filteredTimelineLength}
        activeFilterCount={activeFilterCount}
        onResetFilters={onResetFilters}
        formatCurrency={formatCurrency}
      />

      <BondTimelineDesktopRows
        resultsId={desktopResultsId}
        displayedTimeline={displayedTimeline}
        filteredTimelineLength={filteredTimelineLength}
        activeFilterCount={activeFilterCount}
        rowLimit={rowLimit}
        onRowLimitChange={onRowLimitChange}
        onResetFilters={onResetFilters}
        formatCurrency={formatCurrency}
        firstCashFlowLabel={firstCashFlowLabel}
      />
    </>
  );
}
