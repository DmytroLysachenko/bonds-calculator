'use client';

import { RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BondTimelineRowsProps } from '@/features/single-calculator/types/timeline';
import { useAppI18n } from '@/i18n/client';

import { MobileValue } from './BondTimelineValues';

type BondTimelineMobileRowsProps = Pick<
  BondTimelineRowsProps,
  | 'displayedTimeline'
  | 'filteredTimelineLength'
  | 'activeFilterCount'
  | 'onResetFilters'
  | 'formatCurrency'
> & {
  resultsId: string;
};

export function BondTimelineMobileRows({
  resultsId,
  displayedTimeline,
  filteredTimelineLength,
  activeFilterCount,
  onResetFilters,
  formatCurrency,
}: BondTimelineMobileRowsProps) {
  const { t } = useAppI18n();

  return (
    <div
      id={resultsId}
      role="region"
      aria-label={t('bonds.timeline')}
      className="2xl:hidden overflow-hidden border-y border-border bg-border"
    >
      {filteredTimelineLength > 0 ? (
        <div className="grid gap-px sm:grid-cols-2">
          {displayedTimeline.map((row) => (
            <article
              key={`mobile-${row.key}`}
              className="bg-background p-4 sm:p-5"
              aria-label={`${row.periodLabel}: ${formatCurrency(row.totalWealth)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.periodLabel}</p>
                    {row.projectionLabel ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {row.projectionLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{row.cadenceLabel}</p>
                </div>
                <p className="financial-number shrink-0 text-right text-sm font-semibold text-foreground">
                  {formatCurrency(row.totalWealth)}
                </p>
              </div>

              {row.eventLabels.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {row.eventLabels.map((label, index) => (
                    <Badge
                      key={`mobile-${row.key}-${index}`}
                      variant="secondary"
                      className="h-5 px-2 text-[11px] font-semibold"
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                <MobileValue
                  label={t('bonds.schedule.rate_and_basis')}
                  value={row.interestRateLabel}
                />
                <MobileValue
                  label={t('bonds.early_exit_payout')}
                  value={formatCurrency(row.earlyExitValue)}
                />
                <MobileValue label={row.cashFlowLabel} value={formatCurrency(row.paidOutCash)} />
                <MobileValue label={t('common.net_profit')} value={formatCurrency(row.netProfit)} />
                <MobileValue label={t('bonds.real_value')} value={formatCurrency(row.realValue)} />
                <MobileValue label={t('bonds.schedule.rate_source')} value={row.rateSourceLabel} />
              </div>

              {row.referenceLabel ? (
                <p className="mt-3 border-l-2 border-border px-3 text-xs leading-5 text-muted-foreground">
                  {row.referenceLabel}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-3 bg-background p-8 text-center text-muted-foreground">
          <p>{t('common.no_results_found') || 'No results found for current filters.'}</p>
          {activeFilterCount > 0 ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 gap-2"
                onClick={onResetFilters}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t('common.reset_filters')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
