import { describe, expect, it } from 'vitest';

import { buildInflationChartModel } from './inflation-chart-model';

describe('buildInflationChartModel', () => {
  const series = [
    { date: '2022-01', rate: 2 },
    { date: '2022-02', rate: 3 },
    { date: '2022-03', rate: 14.4 },
    { date: '2022-04', rate: 4 },
  ];

  it('clamps only the readable plot while retaining exact values and edge markers', () => {
    const model = buildInflationChartModel(series, 'readable');

    expect(model.isClipped).toBe(true);
    expect(model.peak).toEqual(series[2]);
    expect(model.chartData[2]).toMatchObject({
      rate: 14.4,
      plotRate: model.cap,
      clippedMarker: true,
    });
    expect(model.chartData[1].clippedMarker).toBe(false);
    expect(model.domain[1]).toBeLessThan(14.4);
  });

  it('preserves the complete peak in full-scale mode', () => {
    const model = buildInflationChartModel(series, 'full');

    expect(model.isClipped).toBe(false);
    expect(model.chartData[2].plotRate).toBe(14.4);
    expect(model.chartData.every((point) => !point.clippedMarker)).toBe(true);
    expect(model.domain[1]).toBeGreaterThan(14.4);
  });

  it('retains a peak that regular downsampling would otherwise skip', () => {
    const dense = Array.from({ length: 400 }, (_, index) => ({
      date: `2022-${String(index + 1).padStart(3, '0')}`,
      rate: index === 201 ? 18 : 2,
    }));
    const model = buildInflationChartModel(dense, 'readable');

    expect(model.peak?.rate).toBe(18);
    expect(model.chartData.some((point) => point.rate === 18)).toBe(true);
  });
});
