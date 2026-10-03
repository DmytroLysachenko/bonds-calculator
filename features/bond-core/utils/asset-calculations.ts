import { addMonths, parseISO } from 'date-fns';

import { HISTORICAL_RETURNS, MonthlyReturn } from '../constants/historical-data';
import { AssetMetadata, AssetPerformanceSeries, DataPoint } from '../types/assets';

import { createMonthlyPriceIndexPath } from './engine/price-index';

function sanitizePercent(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export type HistoricalReplayIssue =
  'missing_history' | 'non_monthly_inflation' | 'missing_observation' | 'non_contiguous';

/** All four replay paths must consume the same complete, monthly PLN window. */
export function getHistoricalReplayIssue(data: MonthlyReturn[]): HistoricalReplayIssue | null {
  if (data.length === 0) return 'missing_history';
  let previousMonth: number | undefined;
  for (const row of data) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(row.date);
    if (!match) return 'missing_observation';
    const month = Number(match[1]) * 12 + Number(match[2]);
    if (previousMonth !== undefined && month !== previousMonth + 1) return 'non_contiguous';
    previousMonth = month;
    if (row.inflationKind !== 'month_on_month') return 'non_monthly_inflation';
    if (
      ![row.sp500, row.gold, row.inflation, row.nbpRate].every(Number.isFinite) ||
      row.sp500 <= -100 ||
      row.gold <= -100 ||
      row.inflation <= -100
    )
      return 'missing_observation';
  }
  return null;
}

function requireHistoricalReplay(data: MonthlyReturn[]) {
  const issue = getHistoricalReplayIssue(data);
  if (issue) throw new Error(`Historical replay unavailable: ${issue}`);
}

/** Annual CPI known at a reset: compound the prior twelve monthly changes. */
function trailingAnnualCpi(data: MonthlyReturn[], resetIndex: number): number {
  if (resetIndex < 12)
    throw new Error('Historical replay unavailable: incomplete CPI reset window');
  return (
    (data
      .slice(resetIndex - 12, resetIndex)
      .reduce((factor, row) => factor * (1 + row.inflation / 100), 1) -
      1) *
    100
  );
}

function historicalPricePath(data: MonthlyReturn[]) {
  return createMonthlyPriceIndexPath(
    data.map((row) => ({
      date: row.date,
      changePercent: row.inflation,
      kind: row.inflationKind,
    })),
  );
}

function monthEnd(date: string) {
  return addMonths(parseISO(`${date}-01`), 1);
}

/**
 * Universal calculation engine for any asset with a return stream.
 * Converts monthly % changes into a growth series with drawdown and inflation adjustment.
 */
export function calculateAssetPerformance(
  initialSum: number,
  monthlyContribution: number,
  returnKey: 'sp500' | 'gold',
  metadata: AssetMetadata,
  data: MonthlyReturn[] = HISTORICAL_RETURNS,
): AssetPerformanceSeries {
  requireHistoricalReplay(data);
  const series: DataPoint[] = [];
  let currentValue = initialSum;
  let unitValue = 1;
  let peakUnitValue = 1;
  const priceIndexPath = historicalPricePath(data);
  const startDate = data[0] ? parseISO(`${data[0].date}-01`) : new Date(2000, 0, 1);

  // Initial Point
  series.push({
    date: 'Start',
    value: initialSum,
    percentChange: 0,
    drawdown: 0,
    realValue: initialSum,
  });

  for (const row of data) {
    const monthlyReturn = row[returnKey];

    // 1. Add monthly contribution at start of month
    currentValue += monthlyContribution;

    // 2. Calculate Nominal Growth
    currentValue *= 1 + monthlyReturn / 100;

    // 3. Calculate Drawdown
    unitValue *= 1 + monthlyReturn / 100;
    peakUnitValue = Math.max(peakUnitValue, unitValue);
    const drawdown = ((peakUnitValue - unitValue) / peakUnitValue) * 100;

    series.push({
      date: row.date,
      value: currentValue,
      percentChange: monthlyReturn,
      drawdown: sanitizePercent(drawdown),
      realValue: priceIndexPath.deflate(currentValue, startDate, monthEnd(row.date)).toNumber(),
    });
  }

  return {
    metadata,
    series,
  };
}

/**
 * Specialized calculation for Bonds (e.g. EDO) using historical inflation.
 */
export function calculateBondsPerformance(
  initialSum: number,
  monthlyContribution: number,
  metadata: AssetMetadata,
  data: MonthlyReturn[] = HISTORICAL_RETURNS,
  config = { firstYearRate: 6.8, margin: 2.0 },
): AssetPerformanceSeries {
  requireHistoricalReplay(data);
  const series: DataPoint[] = [];
  let currentValue = initialSum;
  let unitValue = 1;
  let peakUnitValue = 1;
  const priceIndexPath = historicalPricePath(data);
  const startDate = data[0] ? parseISO(`${data[0].date}-01`) : new Date(2000, 0, 1);

  // Initial Point
  series.push({
    date: 'Start',
    value: initialSum,
    percentChange: 0,
    drawdown: 0,
    realValue: initialSum,
  });

  // Track each "lot" bought monthly to apply its own year-based rate
  const lots: { value: number; monthsHeld: number; annualRate: number }[] = [
    { value: initialSum, monthsHeld: 0, annualRate: config.firstYearRate },
  ];

  for (const [index, row] of data.entries()) {
    const previousValue = currentValue;
    // Add new monthly contribution as a new lot
    if (monthlyContribution > 0) {
      lots.push({ value: monthlyContribution, monthsHeld: 0, annualRate: config.firstYearRate });
    }

    let totalMonthValue = 0;
    for (const lot of lots) {
      if (lot.monthsHeld > 0 && lot.monthsHeld % 12 === 0) {
        lot.annualRate = trailingAnnualCpi(data, index) + config.margin;
      }

      // Interpolate to monthly rate
      const monthlyRate = (Math.pow(1 + lot.annualRate / 100, 1 / 12) - 1) * 100;

      lot.value *= 1 + monthlyRate / 100;
      lot.monthsHeld += 1;
      totalMonthValue += lot.value;
    }

    currentValue = totalMonthValue;

    const investedBeforeReturn = previousValue + Math.max(0, monthlyContribution);
    const periodFactor = investedBeforeReturn > 0 ? currentValue / investedBeforeReturn : 1;
    unitValue *= periodFactor;
    peakUnitValue = Math.max(peakUnitValue, unitValue);
    const drawdown = ((peakUnitValue - unitValue) / peakUnitValue) * 100;

    series.push({
      date: row.date,
      value: currentValue,
      percentChange: 0, // Simplified
      drawdown: sanitizePercent(drawdown),
      realValue: priceIndexPath.deflate(currentValue, startDate, monthEnd(row.date)).toNumber(),
    });
  }

  return {
    metadata,
    series,
  };
}

/**
 * Specialized calculation for Savings Account using historical NBP rates.
 * Assumes monthly capitalization and Belka tax (19%).
 */
export function calculateSavingsPerformance(
  initialSum: number,
  monthlyContribution: number,
  metadata: AssetMetadata,
  data: MonthlyReturn[] = HISTORICAL_RETURNS,
  config = { nbpMargin: 1.0, taxRate: 19 },
): AssetPerformanceSeries {
  requireHistoricalReplay(data);
  const series: DataPoint[] = [];
  let currentValue = initialSum;
  let unitValue = 1;
  let peakUnitValue = 1;
  const priceIndexPath = historicalPricePath(data);
  const startDate = data[0] ? parseISO(`${data[0].date}-01`) : new Date(2000, 0, 1);

  // Initial Point
  series.push({
    date: 'Start',
    value: initialSum,
    percentChange: 0,
    drawdown: 0,
    realValue: initialSum,
  });

  for (const row of data) {
    // 1. Add contribution
    currentValue += monthlyContribution;

    // 2. Calculate Interest based on NBP rate
    const annualRate = Math.max(0, row.nbpRate + config.nbpMargin);
    const monthlyRate = (Math.pow(1 + annualRate / 100, 1 / 12) - 1) * 100;

    const grossInterest = currentValue * (monthlyRate / 100);
    const tax = grossInterest * (config.taxRate / 100);
    const netInterest = grossInterest - tax;

    currentValue += netInterest;

    // 3. Track Drawdown
    unitValue *= 1 + netInterest / (currentValue - netInterest || 1);
    peakUnitValue = Math.max(peakUnitValue, unitValue);
    const drawdown = ((peakUnitValue - unitValue) / peakUnitValue) * 100;

    series.push({
      date: row.date,
      value: currentValue,
      percentChange: sanitizePercent(monthlyRate),
      drawdown: sanitizePercent(drawdown),
      realValue: priceIndexPath.deflate(currentValue, startDate, monthEnd(row.date)).toNumber(),
    });
  }

  return {
    metadata,
    series,
  };
}
