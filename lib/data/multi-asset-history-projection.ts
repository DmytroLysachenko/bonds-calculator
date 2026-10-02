import { type MonthlyReturn } from '@/features/bond-core/constants/historical-data';

export interface MultiAssetSeriesAvailability {
  sp500: boolean;
  gold: boolean;
  inflation: boolean;
  nbpRate: boolean;
}

export interface MultiAssetHistoryEnvelope {
  data: MonthlyReturn[];
  source: 'database' | 'fallback';
  usedFallback: boolean;
  coverageStart: string;
  coverageEnd: string;
  lastSyncedAt?: string;
  seriesAvailability?: MultiAssetSeriesAvailability;
  currencyBasis?: 'PLN' | 'mixed-USD-PLN';
  observationBasis?: 'observed' | 'illustrative';
  coverageGaps?: string[];
}

export interface MultiAssetHistorySource {
  sp500: Array<{ date: string; value: number }>;
  gold: Array<{ date: string; value: number }>;
  inflation: Array<{ date: string; value: number }>;
  nbpRate: Array<{ date: string; value: number }>;
  /** Both equity and gold source levels are USD-denominated. */
  usdPln?: Array<{ date: string; value: number }>;
  inflationUnit?: 'month_on_month_percent' | 'year_over_year_percent';
}

function monthNumber(date: string) {
  if (!/^(\d{4})-(0[1-9]|1[0-2])$/.test(date)) return Number.NaN;
  const [year, month] = date.split('-').map(Number);
  return year * 12 + month;
}

function buildMonthlyPercentChangeMap(series: Array<{ date: string; value: number }>) {
  const result = new Map<string, number>();
  const ordered = [...series].sort((a, b) => a.date.localeCompare(b.date));
  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    if (
      monthNumber(current.date) !== monthNumber(previous.date) + 1 ||
      !Number.isFinite(previous.value) ||
      !Number.isFinite(current.value) ||
      previous.value <= 0 ||
      current.value <= 0
    )
      continue;
    result.set(current.date, ((current.value - previous.value) / previous.value) * 100);
  }

  return result;
}

export function getMultiAssetSeriesAvailability(
  source: MultiAssetHistorySource,
): MultiAssetSeriesAvailability {
  return {
    sp500: source.sp500.length >= 2,
    gold: source.gold.length >= 2,
    inflation: source.inflation.length > 0,
    nbpRate: source.nbpRate.length > 0,
  };
}

/** Pure projection: callers retain ownership of database, cache, and fallback policy. */
export function buildMultiAssetHistory(
  source: MultiAssetHistorySource,
): MultiAssetHistoryEnvelope | null {
  const seriesAvailability = getMultiAssetSeriesAvailability(source);
  if (
    !seriesAvailability.sp500 ||
    !seriesAvailability.gold ||
    !seriesAvailability.inflation ||
    !seriesAvailability.nbpRate ||
    source.inflationUnit !== 'month_on_month_percent' ||
    !source.usdPln ||
    source.usdPln.length < 2
  ) {
    return null;
  }

  const fx = new Map(
    source.usdPln
      .filter((point) => Number.isFinite(point.value) && point.value > 0)
      .map((point) => [point.date, point.value]),
  );
  const convertToPln = (series: MultiAssetHistorySource['sp500']) =>
    series
      .filter((point) => fx.has(point.date))
      .map((point) => ({ date: point.date, value: point.value * fx.get(point.date)! }));
  const sp500Returns = buildMonthlyPercentChangeMap(convertToPln(source.sp500));
  const goldReturns = buildMonthlyPercentChangeMap(convertToPln(source.gold));
  const inflationMap = new Map(
    source.inflation
      .filter((point) => Number.isFinite(point.value) && point.value > -100)
      .map((point) => [point.date, point.value]),
  );
  const nbpMap = new Map(
    source.nbpRate
      .filter((point) => Number.isFinite(point.value))
      .map((point) => [point.date, point.value]),
  );
  const dates = Array.from(sp500Returns.keys())
    .filter((date) => goldReturns.has(date) && inflationMap.has(date) && nbpMap.has(date))
    .sort();
  const data = dates.map((date) => {
    const nbpRate = nbpMap.get(date)!;
    const annualSavingsRate = Math.max(0, nbpRate + 1);
    return {
      date,
      sp500: sp500Returns.get(date)!,
      gold: goldReturns.get(date)!,
      savings: (Math.pow(1 + annualSavingsRate / 100, 1 / 12) - 1) * 100 * 0.81,
      inflation: inflationMap.get(date)!,
      inflationKind: 'month_on_month' as const,
      nbpRate,
    };
  });

  if (data.length === 0) {
    return null;
  }

  const coverageGaps: string[] = [];
  const lastCommonInputMonth = Math.min(
    ...[source.sp500, source.gold, source.inflation, source.nbpRate, source.usdPln].map((series) =>
      Math.max(...series.map((point) => monthNumber(point.date)).filter(Number.isFinite)),
    ),
  );
  const usable = new Set(dates);
  for (let month = monthNumber(dates[0]); month <= lastCommonInputMonth; month += 1) {
    const key = `${Math.floor((month - 1) / 12)}-${String(((month - 1) % 12) + 1).padStart(2, '0')}`;
    if (!usable.has(key)) coverageGaps.push(key);
  }

  return {
    data,
    source: 'database',
    usedFallback: false,
    currencyBasis: 'PLN',
    observationBasis: 'observed',
    coverageGaps,
    coverageStart: data[0].date,
    coverageEnd: data[data.length - 1].date,
    lastSyncedAt: [
      ...source.sp500,
      ...source.gold,
      ...source.inflation,
      ...source.nbpRate,
      ...source.usdPln,
    ]
      .map((point) => point.date)
      .sort()
      .at(-1),
    seriesAvailability,
  };
}
