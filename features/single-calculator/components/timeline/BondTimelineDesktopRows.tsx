'use client';

import { RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollHint,
} from '@/components/ui/table';
import { BondTimelineRowsProps } from '@/features/single-calculator/types/timeline';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { TableDensityControls } from '@/shared/components/results/TableDensityControls';

type BondTimelineDesktopRowsProps = Omit<
  BondTimelineRowsProps,
  'mobileResultsId' | 'desktopResultsId'
> & {
  resultsId: string;
  firstCashFlowLabel: string;
};

export function BondTimelineDesktopRows({
  resultsId,
  displayedTimeline,
  filteredTimelineLength,
  activeFilterCount,
  rowLimit,
  onRowLimitChange,
  onResetFilters,
  formatCurrency,
  firstCashFlowLabel,
}: BondTimelineDesktopRowsProps) {
  const { t } = useAppI18n();
  const densityLabels = {
    rowsShown: t('common.rows_shown'),
    rowsPerPage: t('common.rows_per_page'),
    all: t('common.all'),
    jumpToRows: t('bonds.schedule.jump_to_rows'),
  };

  return (
    <div id={resultsId} className="hidden w-full overflow-hidden bg-card 2xl:block">
      <TableScrollHint>{t('bonds.schedule.mobile_sheet_description')}</TableScrollHint>
      <Table className="w-full table-fixed text-sm tabular-nums" aria-label={t('bonds.timeline')}>
        <TableCaption>{t('bonds.timeline')}</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[10%] whitespace-normal bg-background py-3 leading-4"
            >
              {t('common.period')}
            </TableHead>
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[19%] whitespace-normal bg-background py-3 leading-4"
            >
              {t('bonds.schedule.checkpoint_meaning')}
            </TableHead>
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[14%] whitespace-normal bg-background py-3 leading-4"
            >
              {t('bonds.schedule.rate_and_basis')}
            </TableHead>
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[11%] whitespace-normal bg-background py-3 text-right leading-4"
            >
              {t('bonds.total_wealth')}
            </TableHead>
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[11%] whitespace-normal bg-background py-3 text-right leading-4"
            >
              {firstCashFlowLabel}
            </TableHead>
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[10%] whitespace-normal bg-background py-3 text-right leading-4"
            >
              {t('common.net_profit')}
            </TableHead>
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[10%] whitespace-normal bg-background py-3 text-right leading-4"
            >
              {t('bonds.real_value')}
            </TableHead>
            <TableHead
              scope="col"
              className="sticky top-0 z-10 w-[15%] whitespace-normal bg-background py-3 text-right leading-4"
            >
              {t('bonds.early_exit_payout')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedTimeline.map((row) => (
            <TableRow
              key={row.key}
              className={cn(
                'border-b border-border bg-background transition-colors hover:bg-muted/25',
                row.isWithdrawal ? 'font-semibold' : '',
              )}
            >
              <TableCell className="py-3 align-top">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{row.periodLabel}</span>
                    {row.projectionLabel ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          row.projectionLabel === 'Prognoza' || row.projectionLabel === 'Projected'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {row.projectionLabel}
                      </span>
                    ) : null}
                  </div>
                  {row.eventLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.eventLabels.map((label, index) => (
                        <Badge
                          key={`${row.key}-${index}`}
                          variant="secondary"
                          className="h-5 px-2 text-[11px] font-semibold"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="min-w-0 py-3 align-top text-xs text-muted-foreground">
                <div className="max-w-[28ch] space-y-1 pr-3">
                  <p className="whitespace-normal break-words font-medium leading-5 text-foreground">
                    {row.cadenceLabel}
                  </p>
                  <p className="whitespace-normal break-words text-xs leading-5 text-muted-foreground">
                    {row.valueMeaningLabel}
                  </p>
                </div>
              </TableCell>
              <TableCell className="py-3 align-top">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="financial-number font-mono text-xs font-semibold text-foreground">
                    {row.interestRateLabel}
                  </span>
                  <span className="line-clamp-2 text-xs leading-5">{row.rateSourceLabel}</span>
                  {row.referenceLabel ? (
                    <span className="line-clamp-2 text-[10px] italic leading-4 text-muted-foreground">
                      {row.referenceLabel}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="financial-number py-3 text-right align-top font-mono text-xs">
                {formatCurrency(row.totalWealth)}
              </TableCell>
              <TableCell className="financial-number py-3 text-right align-top font-mono text-xs text-muted-foreground">
                {formatCurrency(row.paidOutCash)}
              </TableCell>
              <TableCell
                className={cn(
                  'financial-number py-3 text-right align-top font-mono text-xs',
                  row.netProfit >= 0 ? 'financial-positive' : 'text-destructive',
                )}
              >
                {formatCurrency(row.netProfit)}
              </TableCell>
              <TableCell className="financial-number py-3 text-right align-top font-mono text-xs text-muted-foreground">
                {formatCurrency(row.realValue)}
              </TableCell>
              <TableCell className="financial-number py-3 align-top text-right font-mono text-xs font-semibold">
                {formatCurrency(row.earlyExitValue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TableDensityControls
        value={rowLimit}
        totalRows={filteredTimelineLength}
        visibleRows={displayedTimeline.length}
        onChange={onRowLimitChange}
        className="px-1"
        labels={densityLabels}
      />

      {filteredTimelineLength === 0 ? (
        <div className="space-y-3 p-12 text-center text-muted-foreground">
          <p>{t('common.no_results_found') || 'No results found for current filters.'}</p>
          {activeFilterCount > 0 ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={onResetFilters}
              >
                <RotateCcw className="h-4 w-4" />
                {t('common.reset_filters')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
