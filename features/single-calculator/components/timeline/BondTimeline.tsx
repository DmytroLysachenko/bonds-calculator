'use client';
import { Filter, RotateCcw, Search } from 'lucide-react';
import React, { useDeferredValue, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimulationEventType } from '@/features/bond-core/types/simulation';
import { BondTimelineProps } from '@/features/single-calculator/types/timeline';
import { useAppI18n } from '@/i18n/client';
import { FormSelect } from '@/shared/components/forms/FormSelect';
import {
  applyTableRowLimit,
  getVisibleRowLabel,
  TableDensityControls,
  TableRowLimit,
} from '@/shared/components/results/TableDensityControls';
import {
  AppLanguage,
  buildBondTimelineDisplayRows,
  getSimulationEventDisplayLabel,
} from '@/shared/lib/bond-display';
import { createCurrencyFormatter } from '@/shared/lib/formatters';

import { BondTimelineRows } from './BondTimelineRows';
import { TimelineStat } from './BondTimelineValues';

const mobileResultsId = 'bond-timeline-mobile-results';
const desktopResultsId = 'bond-timeline-desktop-results';
const timelineResultsIds = `${mobileResultsId} ${desktopResultsId}`;

export const BondTimeline: React.FC<BondTimelineProps> = ({ results, chartStep = 'yearly' }) => {
  const { t, locale: language } = useAppI18n();
  const [hasMounted, setHasMounted] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [rowLimit, setRowLimit] = useState<TableRowLimit>(12);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);
  const formatCurrency = React.useMemo(
    () => (value: number) => {
      if (!hasMounted) return '---';
      return createCurrencyFormatter(language, {
        style: 'currency',
        currency: 'PLN',
      }).format(value);
    },
    [hasMounted, language],
  );
  const effectiveChartStep = chartStep === 'daily' ? 'monthly' : chartStep;
  const displayRows = useMemo(
    () =>
      buildBondTimelineDisplayRows(results.timeline, language as AppLanguage, effectiveChartStep),
    [effectiveChartStep, language, results.timeline],
  );
  const eventOptions = useMemo(
    () =>
      Object.values(SimulationEventType).map((type) => ({
        value: type,
        label: getSimulationEventDisplayLabel(type, language as AppLanguage),
      })),
    [language],
  );
  const filteredTimeline = useMemo(() => {
    return displayRows.filter((row) => {
      const haystack = [
        row.periodLabel,
        row.cadenceLabel,
        row.cycleLabel,
        row.rateSourceLabel,
        row.referenceLabel,
        ...row.eventLabels,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = haystack.includes(deferredSearchQuery.toLowerCase());
      const matchesEvent =
        eventTypeFilter === 'all' ||
        row.eventLabels.includes(
          getSimulationEventDisplayLabel(
            eventTypeFilter as SimulationEventType,
            language as AppLanguage,
          ),
        );
      return matchesSearch && matchesEvent;
    });
  }, [deferredSearchQuery, displayRows, eventTypeFilter, language]);
  const displayedTimeline = useMemo(
    () => applyTableRowLimit(filteredTimeline, rowLimit),
    [filteredTimeline, rowLimit],
  );
  const activeFilterCount =
    (deferredSearchQuery.trim().length > 0 ? 1 : 0) + (eventTypeFilter !== 'all' ? 1 : 0);
  const visibleRangeLabel = getVisibleRowLabel({
    visible: displayedTimeline.length,
    total: filteredTimeline.length,
    allLabel: t('common.rows_visible'),
  });
  const projectionCount = displayRows.filter((row) => !!row.projectionLabel).length;
  const exitMarkers = displayRows.filter((row) => row.isWithdrawal).length;
  const resultsAnnouncement =
    filteredTimeline.length === 0
      ? t('bonds.schedule.no_results_announcement', {
          filters: activeFilterCount,
          projections: projectionCount,
        })
      : t('bonds.schedule.results_announcement', {
          visible: displayedTimeline.length,
          total: filteredTimeline.length,
          filters: activeFilterCount,
          projections: projectionCount,
        });
  const resetFilters = () => {
    setSearchQuery('');
    setEventTypeFilter('all');
    setRowLimit(12);
  };
  return (
    <section className="ui-result-panel space-y-6" aria-label={t('bonds.timeline')}>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {resultsAnnouncement}
      </p>
      <div className="ui-control-stack bg-transparent">
        <div className="ui-metric-grid md:grid-cols-3">
          <TimelineStat label={t('bonds.schedule.rows_after_filters')} value={visibleRangeLabel} />
          <TimelineStat
            label={t('bonds.schedule.projected_points')}
            value={String(projectionCount)}
          />
          <TimelineStat label={t('bonds.schedule.exit_markers')} value={String(exitMarkers)} />
        </div>

        <div className="ui-status-note border-l-border">
          <p className="ui-body ui-pretty text-muted-foreground">
            {t('bonds.schedule.summary_note')}
          </p>
        </div>

        <div className="ui-section-header gap-4">
          <div className="relative w-full md:w-72">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="bond-timeline-search"
              placeholder={t('common.search') || 'Search...'}
              className="h-12 bg-background pl-9"
              aria-label={t('common.search') || 'Search timeline'}
              aria-controls={timelineResultsIds}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="ui-action-row w-full sm:w-auto">
            <div className="flex w-full items-center gap-2 md:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <FormSelect
                id="bond-timeline-event-filter"
                ariaControls={timelineResultsIds}
                value={eventTypeFilter}
                onValueChange={setEventTypeFilter}
                placeholder={t('bonds.filter_events') || 'Filter Events'}
                triggerClassName="w-full bg-background sm:w-56"
                options={[
                  {
                    value: 'all',
                    label: t('common.all_events') || 'All Events',
                  },
                  ...eventOptions,
                ]}
              />
            </div>

            {activeFilterCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 gap-2"
                onClick={resetFilters}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t('common.reset_filters')}
              </Button>
            ) : null}
          </div>
        </div>
        {activeFilterCount > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label={t('bonds.schedule.active_filters')}>
            {deferredSearchQuery.trim() ? (
              <span className="rounded-full bg-muted px-3 py-2 text-xs font-semibold text-foreground">
                {t('common.search')}: {deferredSearchQuery}
              </span>
            ) : null}
            {eventTypeFilter !== 'all' ? (
              <span className="rounded-full bg-muted px-3 py-2 text-xs font-semibold text-foreground">
                {getSimulationEventDisplayLabel(
                  eventTypeFilter as SimulationEventType,
                  language as AppLanguage,
                )}
              </span>
            ) : null}
          </div>
        ) : null}
        <TableDensityControls
          value={rowLimit}
          totalRows={filteredTimeline.length}
          visibleRows={displayedTimeline.length}
          onChange={setRowLimit}
          labels={{
            rowsShown: t('common.rows_shown'),
            rowsPerPage: t('common.rows_per_page'),
            all: t('common.all'),
            jumpToRows: t('bonds.schedule.jump_to_rows'),
          }}
        />
      </div>

      <BondTimelineRows
        mobileResultsId={mobileResultsId}
        desktopResultsId={desktopResultsId}
        displayedTimeline={displayedTimeline}
        filteredTimelineLength={filteredTimeline.length}
        activeFilterCount={activeFilterCount}
        rowLimit={rowLimit}
        onRowLimitChange={setRowLimit}
        onResetFilters={resetFilters}
        formatCurrency={formatCurrency}
      />
    </section>
  );
};
