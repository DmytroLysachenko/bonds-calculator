import { LadderChartMode, LadderTableFilter } from '@/features/ladder-strategy/types/timeline';
import { TableRowLimit } from '@/shared/components/results/TableDensityControls';

const chartModes: LadderChartMode[] = ['yearly', 'monthly'];
const tableFilters: LadderTableFilter[] = ['all', 'peak', 'clustered'];
const rowLimits: TableRowLimit[] = [12, 24, 50, 'all'];

export interface LadderTimelineQueryState {
  chartMode: LadderChartMode;
  tableFilter: LadderTableFilter;
  rowLimit: TableRowLimit;
}

export const defaultLadderTimelineQueryState: LadderTimelineQueryState = {
  chartMode: 'yearly',
  tableFilter: 'all',
  rowLimit: 12,
};

export function readLadderTimelineQueryState(
  searchParams: Pick<URLSearchParams, 'get'>,
): LadderTimelineQueryState {
  const chartMode = searchParams.get('ladderChart');
  const tableFilter = searchParams.get('ladderFilter');
  const rowLimit = searchParams.get('ladderRows');

  return {
    chartMode: chartModes.includes(chartMode as LadderChartMode)
      ? (chartMode as LadderChartMode)
      : defaultLadderTimelineQueryState.chartMode,
    tableFilter: tableFilters.includes(tableFilter as LadderTableFilter)
      ? (tableFilter as LadderTableFilter)
      : defaultLadderTimelineQueryState.tableFilter,
    rowLimit: rowLimits.includes(rowLimit === 'all' ? 'all' : (Number(rowLimit) as TableRowLimit))
      ? rowLimit === 'all'
        ? 'all'
        : (Number(rowLimit) as TableRowLimit)
      : defaultLadderTimelineQueryState.rowLimit,
  };
}

export function getLadderTimelineUrl(currentUrl: URL, state: LadderTimelineQueryState) {
  currentUrl.searchParams.set('ladderChart', state.chartMode);
  currentUrl.searchParams.set('ladderFilter', state.tableFilter);
  currentUrl.searchParams.set('ladderRows', String(state.rowLimit));

  return `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
}
