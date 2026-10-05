'use client';

import { chartColorClass } from '@/shared/components/charts/chart-color-class';

interface EconomicChartTooltipPayloadEntry {
  value: number;
  color: string;
  payload?: { rate?: number };
}

interface EconomicChartTooltipProps {
  active?: boolean;
  payload?: EconomicChartTooltipPayloadEntry[];
  label?: string | number;
  metricLabel: string;
  minWidthClassName?: string;
}

export function EconomicChartTooltip({
  active,
  payload,
  label,
  metricLabel,
  minWidthClassName = 'min-w-[120px]',
}: EconomicChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className={`${minWidthClassName} ui-chart-tooltip p-3`} role="status" aria-live="polite">
      <p className="ui-chart-tooltip-heading mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="ui-chart-tooltip-row">
            <span className="ui-chart-tooltip-label">
              <span className={`ui-chart-tooltip-dot ${chartColorClass(entry.color)}`} />
              {metricLabel}:
            </span>
            <span className="ui-chart-tooltip-value">{entry.payload?.rate ?? entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
