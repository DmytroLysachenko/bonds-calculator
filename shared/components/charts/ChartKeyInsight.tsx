import { ArrowUpRight, Equal, TrendingDown } from 'lucide-react';

import { useAppI18n } from '@/i18n/client';
import { useNumberFormatter } from '@/shared/hooks/useLocalizedFormatters';

export function ChartKeyInsight({
  start,
  end,
  realEnd,
}: {
  start: number;
  end: number;
  realEnd?: number;
}) {
  const { locale, t } = useAppI18n();
  const numberFormatter = useNumberFormatter(locale, { maximumFractionDigits: 0 });
  const delta = end - start;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? TrendingDown : Equal;
  const tone =
    delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <aside
      className="grid gap-3 border-y border-border bg-muted/20 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
      aria-label={t('bonds.simulation.chart_key_insight')}
    >
      <Icon className={`size-5 ${tone}`} aria-hidden="true" />
      <div>
        <p className="ui-kicker">{t('bonds.simulation.chart_key_insight')}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {t('bonds.simulation.chart_key_insight_copy')}
        </p>
      </div>
      <dl className="flex gap-4 text-sm tabular-nums">
        <div>
          <dt className="ui-kicker">{t('common.nominal_value')}</dt>
          <dd className="mt-1 font-semibold text-foreground">{numberFormatter.format(end)}</dd>
        </div>
        {typeof realEnd === 'number' ? (
          <div>
            <dt className="ui-kicker">{t('common.real_value')}</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {numberFormatter.format(realEnd)}
            </dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}
