import { addMonths } from 'date-fns';
import { Decimal } from 'decimal.js';

import { priceIndexPathForProjection } from './price-index';

/**
 * Returns the expected inflation for a specific year of the simulation.
 */
export function getExpectedInflationForYearIndex(
  expectedInflation: number,
  customInflation: number[] | undefined,
  yearIndex: number,
): number {
  if (customInflation && customInflation.length > yearIndex) {
    return customInflation[yearIndex];
  }

  return expectedInflation;
}

/** @deprecated Prefer priceIndexPathForProjection(...).factorBetween(...). */
export function calculateCumulativeInflation(
  totalMonths: number,
  expectedInflation: number,
  customInflation?: number[],
  startPurchaseDate = new Date(2000, 0, 1),
): Decimal {
  return priceIndexPathForProjection(
    startPurchaseDate,
    expectedInflation,
    customInflation,
  ).factorBetween(startPurchaseDate, addMonths(startPurchaseDate, totalMonths));
}

/**
 * @deprecated Prefer the PriceIndexPath API.
 */
export function calculateCumulativeInflationForDates(
  startDate: Date,
  endDate: Date,
  expectedInflation: number,
  customInflation?: number[],
): Decimal {
  return priceIndexPathForProjection(startDate, expectedInflation, customInflation).factorBetween(
    startDate,
    endDate,
  );
}
