import { addMonths, differenceInDays, parseISO } from 'date-fns';
import { Decimal } from 'decimal.js';

/**
 * A purchasing-power index. This is intentionally separate from the CPI
 * observations used to reset inflation-linked bond coupons: reset CPI is a
 * lagged, published rate; this path is the denominator for real values.
 */
export interface PriceIndexPath {
  /** How faithfully the path represents an observed price index. */
  readonly precision: 'projected-annual-interpolation' | 'monthly-index' | 'approximate';
  indexAt(date: Date): Decimal;
  factorBetween(startDate: Date, endDate: Date): Decimal;
  deflate(value: Decimal.Value, fromDate: Date, toDate: Date): Decimal;
}

export interface AnnualPriceIndexPathInput {
  startDate: Date;
  annualCpiPercent: number;
  annualCpiPercentByYear?: readonly number[];
}

function annualRateForYear({
  annualCpiPercent,
  annualCpiPercentByYear,
  yearIndex,
}: Omit<AnnualPriceIndexPathInput, 'startDate'> & { yearIndex: number }) {
  return annualCpiPercentByYear?.[yearIndex] ?? annualCpiPercent;
}

function annualFactor(rate: number) {
  const factor = new Decimal(1).plus(new Decimal(rate).dividedBy(100));
  if (factor.lte(0)) {
    throw new RangeError('Annual CPI must be greater than -100% to form a price index.');
  }
  return factor;
}

/**
 * Creates an annual-effective projected price path. Each anniversary is an
 * anchor: a 12% rate turns one full anchor year into exactly 1.12. Dates
 * between anchors use exponential (log-linear) interpolation, including
 * partial months and leap-year spans.
 */
export function createAnnualPriceIndexPath({
  startDate,
  annualCpiPercent,
  annualCpiPercentByYear,
}: AnnualPriceIndexPathInput): PriceIndexPath {
  const indexAt = (date: Date) => {
    if (date.getTime() <= startDate.getTime()) return new Decimal(1);

    let index = new Decimal(1);
    let yearIndex = 0;
    let segmentStart = startDate;

    while (segmentStart.getTime() < date.getTime()) {
      const segmentAnchor = addMonths(startDate, (yearIndex + 1) * 12);
      const segmentEnd = segmentAnchor.getTime() < date.getTime() ? segmentAnchor : date;
      const anchorDays = differenceInDays(segmentAnchor, segmentStart);
      const elapsedDays = differenceInDays(segmentEnd, segmentStart);

      if (anchorDays > 0 && elapsedDays > 0) {
        index = index.times(
          annualFactor(
            annualRateForYear({ annualCpiPercent, annualCpiPercentByYear, yearIndex }),
          ).pow(new Decimal(elapsedDays).dividedBy(anchorDays)),
        );
      }
      segmentStart = segmentEnd;
      yearIndex += 1;
    }

    return index;
  };

  return {
    precision: 'projected-annual-interpolation',
    indexAt,
    factorBetween: (from, to) => {
      if (to.getTime() <= from.getTime()) return new Decimal(1);
      return indexAt(to).dividedBy(indexAt(from));
    },
    deflate: (value, from, to) =>
      new Decimal(value).dividedBy(indexAt(to).dividedBy(indexAt(from))),
  };
}

export interface MonthlyPriceIndexChange {
  /** YYYY-MM, interpreted as the price-index anchor at the end of that month. */
  date: string;
  changePercent?: number;
  kind?: 'month_on_month' | 'year_over_year';
}

/**
 * Builds a path from month-on-month changes. Missing observations deliberately
 * keep the previous index and mark the path approximate; a YoY CPI series is
 * not silently presented as an exact historical deflator.
 */
export function createMonthlyPriceIndexPath(
  changes: readonly MonthlyPriceIndexChange[],
): PriceIndexPath {
  const ordered = [...changes].sort((left, right) => left.date.localeCompare(right.date));
  const anchors: Array<{ date: Date; index: Decimal }> = [];
  let index = new Decimal(1);
  let approximate = false;

  for (const change of ordered) {
    if (change.changePercent === undefined || !Number.isFinite(change.changePercent)) {
      approximate = true;
    } else {
      // A YoY CPI rate is not an observed monthly index. Convert it to an
      // annual-effective monthly factor and retain the approximation label.
      const factor = annualFactor(change.changePercent);
      index = index.times(
        change.kind === 'year_over_year' ? factor.pow(new Decimal(1).dividedBy(12)) : factor,
      );
      approximate ||= change.kind === 'year_over_year';
    }
    anchors.push({ date: addMonths(parseISO(`${change.date}-01`), 1), index });
  }

  const indexAt = (date: Date) => {
    if (anchors.length === 0 || date.getTime() < anchors[0].date.getTime()) return new Decimal(1);
    let previous = anchors[0];
    for (const anchor of anchors) {
      if (anchor.date.getTime() === date.getTime()) return anchor.index;
      if (anchor.date.getTime() > date.getTime()) {
        const span = differenceInDays(anchor.date, previous.date);
        const elapsed = differenceInDays(date, previous.date);
        if (span <= 0 || elapsed <= 0) return previous.index;
        return previous.index.times(
          anchor.index.dividedBy(previous.index).pow(new Decimal(elapsed).dividedBy(span)),
        );
      }
      previous = anchor;
    }
    return previous.index;
  };

  return {
    precision: approximate ? 'approximate' : 'monthly-index',
    indexAt,
    factorBetween: (from, to) =>
      to.getTime() <= from.getTime() ? new Decimal(1) : indexAt(to).dividedBy(indexAt(from)),
    deflate: (value, from, to) =>
      new Decimal(value).dividedBy(indexAt(to).dividedBy(indexAt(from))),
  };
}

/** A stable label for receipts and UI, rather than an unsupported exactness claim. */
export function describePriceIndexPath(path: PriceIndexPath) {
  if (path.precision === 'monthly-index') return 'Observed month-on-month price index.';
  if (path.precision === 'approximate')
    return 'Approximate price index: monthly CPI observations are incomplete.';
  return 'Projected annual-effective CPI path with date interpolation.';
}

export function priceIndexPathForProjection(
  startDate: Date,
  expectedInflation: number,
  customInflation?: readonly number[],
) {
  return createAnnualPriceIndexPath({
    startDate,
    annualCpiPercent: expectedInflation,
    annualCpiPercentByYear: customInflation,
  });
}
