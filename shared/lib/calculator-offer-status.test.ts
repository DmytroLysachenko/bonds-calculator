import { describe, expect, it } from 'vitest';

import { BondType } from '@/features/bond-core/types';

import {
  getCalculatorOfferStatus,
  hasCurrentOfferChanged,
  isCurrentOfferInput,
} from './calculator-offer-status';

const current = { bondType: BondType.EDO, firstYearRate: 5.5, margin: 2, duration: 10 };
const definitions = { [BondType.EDO]: { firstYearRate: 5.5, margin: 2, duration: 10 } } as never;

describe('calculator offer status', () => {
  it('recognizes a current series selection', () =>
    expect(isCurrentOfferInput(current)).toBe(true));
  it('recognizes an explicit current series selection', () =>
    expect(isCurrentOfferInput({ ...current, selectedSeriesId: 'current' })).toBe(true));
  it('does not compare historical series', () =>
    expect(
      isCurrentOfferInput({ ...current, selectedSeriesId: '11111111-1111-1111-1111-111111111111' }),
    ).toBe(false));
  it('keeps matching terms current', () =>
    expect(getCalculatorOfferStatus(current, definitions)).toBe('current'));
  it('marks a changed first-year rate as previous offer', () =>
    expect(getCalculatorOfferStatus({ ...current, firstYearRate: 5.2 }, definitions)).toBe(
      'previous-offer',
    ));
  it('marks a changed margin as previous offer', () =>
    expect(getCalculatorOfferStatus({ ...current, margin: 1.5 }, definitions)).toBe(
      'previous-offer',
    ));
  it('marks a changed duration as previous offer', () =>
    expect(getCalculatorOfferStatus({ ...current, duration: 4 }, definitions)).toBe(
      'previous-offer',
    ));
  it('does not mark a historical series previous offer', () =>
    expect(getCalculatorOfferStatus({ ...current, selectedSeriesId: 'series' }, definitions)).toBe(
      'not-applicable',
    ));
  it('does not mark missing definitions previous offer', () =>
    expect(getCalculatorOfferStatus(current, undefined)).toBe('current'));
  it('does not compare missing committed inputs', () =>
    expect(hasCurrentOfferChanged(null, definitions)).toBe(false));
  it('does not compare a missing bond definition', () =>
    expect(hasCurrentOfferChanged({ ...current, bondType: BondType.COI }, definitions)).toBe(
      false,
    ));
});
