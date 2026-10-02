import { and, asc, gte, inArray, lte } from 'drizzle-orm';
import { cache } from 'react';

import { db } from '@/db';
import { dataPoints, dataSeries } from '@/db/schema';
import {
  HISTORICAL_RETURNS,
  type MonthlyReturn,
} from '@/features/bond-core/constants/historical-data';
import { HistoricalAverages } from '@/features/bond-core/types/scenarios';

import {
  CPI_MOM_SLUGS,
  CPI_SLUGS,
  getCached,
  GOLD_SLUGS,
  NBP_RATE_SLUGS,
  setCache,
  SP500_SLUGS,
  USD_PLN_SLUGS,
} from './market-data-cache';
import {
  buildMultiAssetHistory,
  getMultiAssetSeriesAvailability,
  type MultiAssetHistoryEnvelope,
  type MultiAssetSeriesAvailability,
} from './multi-asset-history-projection';

const EMPTY_MULTI_ASSET_AVAILABILITY: MultiAssetSeriesAvailability = {
  sp500: false,
  gold: false,
  inflation: false,
  nbpRate: false,
};

function getFallbackCoverageBounds() {
  return {
    coverageStart: HISTORICAL_RETURNS[0]?.date ?? '2020-01',
    coverageEnd: HISTORICAL_RETURNS[HISTORICAL_RETURNS.length - 1]?.date ?? '2024-06',
  };
}

export function createFallbackMultiAssetHistory(
  seriesAvailability: MultiAssetSeriesAvailability = EMPTY_MULTI_ASSET_AVAILABILITY,
): MultiAssetHistoryEnvelope {
  return {
    data: HISTORICAL_RETURNS,
    source: 'fallback',
    usedFallback: true,
    ...getFallbackCoverageBounds(),
    currencyBasis: 'mixed-USD-PLN',
    observationBasis: 'illustrative',
    coverageGaps: [],
    seriesAvailability,
  };
}

export const getMultiAssetHistory = cache(async (): Promise<MultiAssetHistoryEnvelope> => {
  const cacheKey = 'multi-asset-history';
  const cached = getCached<MultiAssetHistoryEnvelope>(cacheKey);
  if (cached) return cached;

  const fromDate = '1990-01-01';
  const toDate = new Date().toISOString().slice(0, 10);

  try {
    const allAliases = [
      ...SP500_SLUGS,
      ...GOLD_SLUGS,
      ...CPI_SLUGS,
      ...CPI_MOM_SLUGS,
      ...NBP_RATE_SLUGS,
      ...USD_PLN_SLUGS,
    ];
    const series = await db.query.dataSeries.findMany({
      where: inArray(dataSeries.slug, allAliases),
    });

    if (series.length === 0) {
      throw new Error('No data series found');
    }

    const seriesIds = series.map((s) => s.id);
    const sp500Id = series.find((s) => SP500_SLUGS.includes(s.slug))?.id;
    const goldId = series.find((s) => GOLD_SLUGS.includes(s.slug))?.id;
    const cpiId = series.find((s) => CPI_MOM_SLUGS.includes(s.slug))?.id;
    const nbpId = series.find((s) => NBP_RATE_SLUGS.includes(s.slug))?.id;
    const fxId = series.find((s) => USD_PLN_SLUGS.includes(s.slug))?.id;

    const allPoints = await db.query.dataPoints.findMany({
      where: and(
        inArray(dataPoints.seriesId, seriesIds),
        gte(dataPoints.date, fromDate),
        lte(dataPoints.date, toDate),
      ),
      orderBy: [asc(dataPoints.date)],
    });

    const pointsBySeries: Record<string, { date: string; value: number }[]> = {};
    allPoints.forEach((point) => {
      if (!pointsBySeries[point.seriesId]) pointsBySeries[point.seriesId] = [];
      pointsBySeries[point.seriesId].push({
        date: point.date.substring(0, 7),
        value: parseFloat(point.value),
      });
    });

    const sp500Points = sp500Id ? pointsBySeries[sp500Id] || [] : [];
    const goldPoints = goldId ? pointsBySeries[goldId] || [] : [];
    const inflationPoints = cpiId ? pointsBySeries[cpiId] || [] : [];
    const nbpPoints = nbpId ? pointsBySeries[nbpId] || [] : [];

    const source = {
      sp500: sp500Points,
      gold: goldPoints,
      inflation: inflationPoints,
      nbpRate: nbpPoints,
      usdPln: fxId ? pointsBySeries[fxId] || [] : [],
      inflationUnit: 'month_on_month_percent' as const,
    };
    const seriesAvailability = getMultiAssetSeriesAvailability(source);
    const result = buildMultiAssetHistory(source);

    if (!result) {
      const fallbackResult = createFallbackMultiAssetHistory(seriesAvailability);
      setCache(cacheKey, fallbackResult);
      return fallbackResult;
    }
    setCache(cacheKey, result);
    return result;
  } catch {
    return createFallbackMultiAssetHistory();
  }
});

/** The illustrative fallback stores month-on-month changes; macro assumptions need annual CPI. */
export function fallbackAnnualInflationObservations(rows: MonthlyReturn[]): number[] {
  return rows.flatMap((_, index) => {
    if (index < 11) return [];
    const year = rows.slice(index - 11, index + 1);
    if (
      year.some(
        (row, monthIndex) =>
          row.inflationKind !== 'month_on_month' ||
          !Number.isFinite(row.inflation) ||
          row.inflation <= -100 ||
          (monthIndex > 0 &&
            Number(year[monthIndex - 1].date.slice(0, 4)) * 12 +
              Number(year[monthIndex - 1].date.slice(5, 7)) +
              1 !==
              Number(row.date.slice(0, 4)) * 12 + Number(row.date.slice(5, 7))),
      )
    )
      return [];
    return [(year.reduce((factor, row) => factor * (1 + row.inflation / 100), 1) - 1) * 100];
  });
}

export const getHistoricalAverages = cache(async (): Promise<HistoricalAverages> => {
  const cacheKey = 'historical-averages';
  const cached = getCached<HistoricalAverages>(cacheKey);
  if (cached) return cached;

  // Core bond assumptions depend only on macro observations. The experimental
  // equity/gold replay may have gaps or a different currency basis.
  const macro: { inflation: number[]; nbpRate: number[] } = { inflation: [], nbpRate: [] };
  try {
    const series = await db.query.dataSeries.findMany({
      where: inArray(dataSeries.slug, [...CPI_SLUGS, ...NBP_RATE_SLUGS]),
    });
    const cpiId = series.find((item) => CPI_SLUGS.includes(item.slug))?.id;
    const nbpId = series.find((item) => NBP_RATE_SLUGS.includes(item.slug))?.id;
    const ids = [cpiId, nbpId].filter((id): id is string => Boolean(id));
    if (ids.length) {
      const points = await db.query.dataPoints.findMany({
        where: inArray(dataPoints.seriesId, ids),
        orderBy: [asc(dataPoints.date)],
      });
      for (const point of points) {
        const value = Number(point.value);
        if (!Number.isFinite(value)) continue;
        if (point.seriesId === cpiId) macro.inflation.push(value);
        if (point.seriesId === nbpId) macro.nbpRate.push(value);
      }
    }
  } catch {
    // Offline macro defaults remain explicit and independent of asset rows.
  }

  const calculateAverage = (values: number[], fallback: number[], months: number) => {
    const recent = (values.length ? values : fallback).slice(-months);
    return recent.reduce((sum, value) => sum + value, 0) / recent.length;
  };
  const fallbackInflation = fallbackAnnualInflationObservations(HISTORICAL_RETURNS);
  const fallbackNbp = HISTORICAL_RETURNS.map((row) => row.nbpRate);

  const result: HistoricalAverages = {
    inflation: {
      '1y': calculateAverage(macro.inflation, fallbackInflation, 12),
      '5y': calculateAverage(macro.inflation, fallbackInflation, 60),
      '10y': calculateAverage(macro.inflation, fallbackInflation, 120),
    },
    nbpRate: {
      '1y': calculateAverage(macro.nbpRate, fallbackNbp, 12),
      '5y': calculateAverage(macro.nbpRate, fallbackNbp, 60),
      '10y': calculateAverage(macro.nbpRate, fallbackNbp, 120),
    },
  };

  setCache(cacheKey, result);
  return result;
});
