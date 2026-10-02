import { describe, expect, it } from 'vitest';

import { buildMaturityIcs, estimateSettlementDate } from './maturity-planner';
describe('maturity planner', () => {
  it('moves a Friday request to the next business day', () =>
    expect(estimateSettlementDate('2026-01-02')).toBe('2026-01-05'));
  it('writes all-day escaped ICS events', () =>
    expect(
      buildMaturityIcs([
        {
          id: 'lot-1',
          date: '2026-01-01',
          title: 'Maturity, COI',
          description: 'Principal; interest',
        },
      ]),
    ).toContain('DTSTART;VALUE=DATE:20260101\r\nSUMMARY:Maturity\\, COI'));
});
