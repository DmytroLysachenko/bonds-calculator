'use client';

import { useAppI18n } from '@/i18n/client';
import { chartColorClass } from '@/shared/components/charts/chart-color-class';

import { MultiAssetDrawdownTooltipProps, MultiAssetGrowthTooltipProps } from '../types/multi-asset';

export function MultiAssetGrowthTooltip({
  active,
  payload,
  label,
  formatCurrency,
}: MultiAssetGrowthTooltipProps) {
  const { t } = useAppI18n();
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const inflation = data.inflation;
  const nbp = data.nbp;

  return (
    <div className="ui-chart-tooltip min-w-[220px] p-4" role="status" aria-live="polite">
      <p className="ui-chart-tooltip-heading mb-3">{label}</p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          {payload
            .filter(
              (entry) =>
                entry.dataKey &&
                !String(entry.dataKey).includes('_drawdown') &&
                !['inflation', 'nbp'].includes(String(entry.dataKey)),
            )
            .map((entry, index) => (
              <div key={index} className="ui-chart-tooltip-row">
                <span className="ui-chart-tooltip-label">
                  <span
                    className={`ui-chart-tooltip-dot ${chartColorClass(entry.color)}`}
                    aria-hidden="true"
                  />
                  {entry.name}:
                </span>
                <span className="ui-chart-tooltip-value">
                  {formatCurrency(Number(entry.value))}
                </span>
              </div>
            ))}
        </div>

        {inflation !== undefined || nbp !== undefined ? (
          <div className="ui-chart-tooltip-context mt-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('common.context_rates')}
            </p>
            {inflation !== undefined ? (
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  <span className="font-medium text-muted-foreground">
                    {t('bonds.ref_inflation')}:
                  </span>
                </span>
                <span className="font-semibold text-warning">{Number(inflation).toFixed(2)}%</span>
              </div>
            ) : null}
            {nbp !== undefined ? (
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  <span className="font-medium text-muted-foreground">
                    {t('bonds.nbp_rate_short')}:
                  </span>
                </span>
                <span className="font-semibold text-primary">{Number(nbp).toFixed(2)}%</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MultiAssetDrawdownTooltip({
  active,
  payload,
  label,
}: MultiAssetDrawdownTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="ui-chart-tooltip min-w-[180px] p-3" role="status" aria-live="polite">
      <p className="ui-chart-tooltip-heading mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="ui-chart-tooltip-row">
            <span className="ui-chart-tooltip-label">
              <span className={`ui-chart-tooltip-dot ${chartColorClass(entry.color)}`} />
              {entry.name}:
            </span>
            <span className="ui-chart-tooltip-value text-destructive">
              -{Number(entry.value).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
