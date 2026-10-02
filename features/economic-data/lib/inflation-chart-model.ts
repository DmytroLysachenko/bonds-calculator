import {
  computeRateDomain,
  computeReadableRateDomain,
  sampleSeriesPoints,
} from '@/shared/lib/chart-series';

import type { EconomicSeriesPoint } from './economic-dashboard-model';

export interface InflationPlotPoint extends EconomicSeriesPoint {
  plotRate: number;
  clippedMarker: boolean;
}

export function buildInflationChartModel(
  series: EconomicSeriesPoint[],
  scaleMode: 'readable' | 'full',
) {
  const peak = series.reduce<EconomicSeriesPoint | null>(
    (current, point) => (!current || point.rate > current.rate ? point : current),
    null,
  );
  const sampled = sampleSeriesPoints(series, 160);
  const sampledSet = new Set(sampled);
  const points =
    peak && !sampled.includes(peak)
      ? series.filter((point) => point === peak || sampledSet.has(point))
      : sampled;
  const rates = series.map((point) => point.rate);
  const readableDomain = computeReadableRateDomain(rates);
  const domain = scaleMode === 'full' ? computeRateDomain(rates) : readableDomain;
  const cap = readableDomain[1];
  const isClipped = scaleMode === 'readable' && peak !== null && peak.rate > cap;

  const chartData: InflationPlotPoint[] = points.map((point, index) => {
    const clipped = isClipped && point.rate > cap;
    const previousClipped = index > 0 && points[index - 1].rate > cap;
    const nextClipped = index < points.length - 1 && points[index + 1].rate > cap;
    return {
      ...point,
      plotRate: clipped ? cap : point.rate,
      clippedMarker: clipped && (!previousClipped || !nextClipped),
    };
  });

  return { chartData, domain, peak, cap, isClipped };
}
