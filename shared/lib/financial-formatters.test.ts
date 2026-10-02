import { describe, expect, it } from 'vitest';

import {
  formatCompactNumber,
  formatCurrency,
  formatIsoDate,
  formatPercent,
} from './financial-formatters';

describe('financial formatters', () => {
  it('formats currency through the selected locale', () => {
    expect(formatCurrency(1234.5, 'pl')).toContain('1');
    expect(formatCurrency(1234.5, 'pl')).toContain('zł');
    expect(formatCurrency(1234.5, 'en')).toContain('PLN');
  });

  it('formats percentage inputs expressed as percentage points', () => {
    expect(formatPercent(5.25, 'pl')).toMatch(/5[,.]25/);
    expect(formatPercent(5.25, 'en', 1)).toContain('5.3');
  });

  it('uses compact notation only for display values', () => {
    expect(formatCompactNumber(1_250_000, 'pl')).toMatch(/mln|M/i);
    expect(formatCompactNumber(1_250_000, 'en')).toMatch(/M/i);
  });

  it('formats valid ISO calendar dates without timezone drift', () => {
    expect(formatIsoDate('2026-07-30', 'pl')).toContain('2026');
    expect(formatIsoDate('2026-07-30', 'en')).toContain('2026');
  });

  it('keeps a date-only value stable around daylight-saving transitions', () => {
    expect(formatIsoDate('2026-03-29', 'pl')).toContain('29');
    expect(formatIsoDate('2026-10-25', 'en')).toContain('25');
  });

  it('does not use compact formatting for a negative or small value unexpectedly', () => {
    expect(formatCompactNumber(-12, 'en')).toContain('-12');
    expect(formatCompactNumber(999, 'pl')).toContain('999');
  });

  it.each(['2026-02-30', '30.07.2026', '', '2026-7-3'])(
    'returns malformed input unchanged: %s',
    (value) => {
      expect(formatIsoDate(value, 'pl')).toBe(value);
    },
  );
});
