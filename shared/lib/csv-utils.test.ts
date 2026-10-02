import { describe, expect, it } from 'vitest';

import type { LotBreakdown, YearlyTimelinePoint } from '@/features/bond-core/types';
import { SimulationEventType } from '@/features/bond-core/types/simulation';
import { translateMessage } from '@/i18n/translate';

import { convertComparisonToCSV, convertLotsToCSV, convertTimelineToCSV } from './csv-utils';
import {
  buildComparisonExportHeaders,
  buildLotsExportHeaders,
  buildTimelineExportHeaders,
} from './export-headers';

describe('csv-utils', () => {
  it('appends committed report provenance without changing timeline numeric columns', () => {
    const headers = buildTimelineExportHeaders((key) => translateMessage('en', key));
    const timeline = [
      {
        periodLabel: 'Sep 2026',
        cycleIndex: 1,
        cycleStartDate: '2026-09-01',
        cycleEndDate: '2026-09-01',
        interestRate: 5.35,
        rateSource: 'initial_principal',
        nominalValueBeforeInterest: 1000,
        interestEarned: 0,
        taxDeducted: 0,
        netInterest: 0,
        nominalValueAfterInterest: 1000,
        accumulatedNetInterest: 0,
        totalValue: 990,
        realValue: 950,
        netProfit: -10,
        earlyWithdrawalValue: 990,
        isMaturity: false,
        isWithdrawal: true,
        cumulativeInflation: 1,
      },
    ] as unknown as YearlyTimelinePoint[];
    const plain = convertTimelineToCSV(timeline, headers, 'en').split('\r\n');
    const withMetadata = convertTimelineToCSV(timeline, headers, 'en', {
      calculationVersion: 'historical-model-v7',
      offerSeries: 'EDO0936',
      offerRevision: 'terms-2026-09',
      taxStrategy: 'STANDARD',
      cashPolicy: 'single_cycle',
      dataSource: 'gov.pl',
      coverageAsOf: '2026-09-01',
    }).split('\r\n');

    expect(withMetadata[0]?.startsWith(`${plain[0]};`)).toBe(true);
    expect(withMetadata[1]?.startsWith(`${plain[1]};`)).toBe(true);
    expect(withMetadata[1]).toContain('-10.00');
    expect(withMetadata[1]).toContain('"historical-model-v7"');
    expect(withMetadata[1]).toContain('"terms-2026-09"');
    expect(withMetadata[1]).toContain('"gov.pl"');
    expect(withMetadata[1]).toContain('"2026-09-01"');
  });

  it('builds a normalized timeline csv with localized helper columns', () => {
    const headers = buildTimelineExportHeaders((key) => translateMessage('pl', key));
    const timeline = [
      {
        year: 1,
        interestRate: 6.5,
        interestEarned: 650,
        nominalValueAfterInterest: 10650,
        taxPaid: 0,
        realValue: 10300,
        totalValue: 10650,
        cycleStartDate: '2026-05-14',
        cycleEndDate: '2027-05-14',
        isProjected: false,
        rateSource: 'initial_principal',
        eventType: 'purchase',
      },
    ] as unknown as YearlyTimelinePoint[];

    const csv = convertTimelineToCSV(timeline, headers, 'pl');

    expect(csv).toContain('Jak to zostało obliczone');
    expect(csv).toContain('Prognozowane');
    expect(csv).toContain('Kontrolny punkt scenariusza');
  });

  it('exports payout-bond timeline rows with total wealth and early exit semantics', () => {
    const headers = buildTimelineExportHeaders((key) => translateMessage('en', key));
    const timeline = [
      {
        periodLabel: 'Jun 2026',
        cycleIndex: 1,
        cycleStartDate: '2026-06-01',
        cycleEndDate: '2026-06-30',
        interestRate: 5.25,
        rateSource: 'historical_nbp',
        nominalValueBeforeInterest: 10000,
        interestEarned: 43,
        taxDeducted: 0,
        netInterest: 43,
        nominalValueAfterInterest: 10000,
        accumulatedNetInterest: 43,
        totalValue: 10043,
        realValue: 9950,
        netProfit: 43,
        earlyWithdrawalValue: 10021,
        isMaturity: false,
        isWithdrawal: false,
        cumulativeInflation: 1.02,
        events: [
          {
            type: SimulationEventType.PAYOUT,
            date: '2026-06-30',
            description: 'Monthly payout',
          },
        ],
      },
    ] as unknown as YearlyTimelinePoint[];

    const csv = convertTimelineToCSV(timeline, headers, 'en');

    expect(csv).toContain('Cash paid out');
    expect(csv).toContain('Final Nominal Value');
    expect(csv).toContain('Early Exit Payout');
    expect(csv).toContain('Payout or rollover point');
  });

  it('exports retained-interest headers for capitalizing bond timelines', () => {
    const headers = buildTimelineExportHeaders((key) => translateMessage('en', key));
    const timeline = [
      {
        periodLabel: 'May 2027',
        cycleIndex: 1,
        cycleStartDate: '2026-05-19',
        cycleEndDate: '2027-05-19',
        interestRate: 5.35,
        rateSource: 'first_year_fixed',
        nominalValueBeforeInterest: 10000,
        interestEarned: 535,
        taxDeducted: 0,
        netInterest: 535,
        nominalValueAfterInterest: 10535,
        accumulatedNetInterest: 535,
        totalValue: 10535,
        realValue: 10100,
        netProfit: 535,
        earlyWithdrawalValue: 10413.35,
        isMaturity: false,
        isWithdrawal: false,
        cumulativeInflation: 1.03,
        events: [
          {
            type: SimulationEventType.INTEREST_ACCRUAL,
            date: '2027-05-19',
            description: 'Annual accrual',
          },
        ],
      },
    ] as unknown as YearlyTimelinePoint[];

    const csv = convertTimelineToCSV(timeline, headers, 'en');

    expect(csv).toContain('Interest retained in bond');
    expect(csv).not.toContain('Cash paid out');
  });

  it('builds lot csv using the selected locale formatting', () => {
    const headers = buildLotsExportHeaders((key) => translateMessage('pl', key));
    const lots = [
      {
        purchaseDate: '2026-05-14',
        maturityDate: '2030-05-14',
        investedAmount: 10000,
        accumulatedInterest: 1200.5,
        tax: 228.1,
        earlyWithdrawalFee: 0,
        netValue: 10972.4,
      },
    ] as LotBreakdown[];

    const csv = convertLotsToCSV(lots, headers, 'pl');

    expect(csv).toContain('"2026-05-14"');
    expect(csv).toContain('1200,50');
    expect(csv).toContain('10972,40');
  });

  it('adds an explicit export date column to single-bond timeline csv output', () => {
    const headers = buildTimelineExportHeaders((key) => translateMessage('en', key));
    const timeline = [
      {
        periodLabel: 'Jun 2026',
        cycleIndex: 1,
        cycleStartDate: '2026-06-01',
        cycleEndDate: '2026-06-30T00:00:00.000Z',
        interestRate: 5.25,
        rateSource: 'historical_nbp',
        nominalValueBeforeInterest: 10000,
        interestEarned: 43,
        taxDeducted: 0,
        netInterest: 43,
        nominalValueAfterInterest: 10000,
        accumulatedNetInterest: 43,
        totalValue: 10043,
        realValue: 9950,
        netProfit: 43,
        earlyWithdrawalValue: 10021,
        isMaturity: false,
        isWithdrawal: false,
        cumulativeInflation: 1.02,
      },
    ] as unknown as YearlyTimelinePoint[];

    const csv = convertTimelineToCSV(timeline, headers, 'en');

    expect(csv).toContain('As of');
    expect(csv).toContain('"2026-06-30"');
  });

  it('builds a combined comparison csv aligned by actual calendar date', () => {
    const headers = buildComparisonExportHeaders((key) => translateMessage('en', key));
    const timelineA = [
      {
        periodLabel: 'Jun 2026',
        cycleIndex: 1,
        cycleStartDate: '2026-06-01',
        cycleEndDate: '2026-06-30',
        interestRate: 5.25,
        rateSource: 'historical_nbp',
        nominalValueBeforeInterest: 10000,
        interestEarned: 43,
        taxDeducted: 0,
        netInterest: 43,
        nominalValueAfterInterest: 10000,
        accumulatedNetInterest: 43,
        totalValue: 10043,
        realValue: 9950,
        netProfit: 43,
        earlyWithdrawalValue: 10021,
        isMaturity: false,
        isWithdrawal: false,
        cumulativeInflation: 1.02,
        events: [
          { type: SimulationEventType.PAYOUT, date: '2026-06-30', description: 'Monthly payout' },
        ],
      },
    ] as unknown as YearlyTimelinePoint[];
    const timelineB = [
      {
        periodLabel: 'Jul 2026',
        cycleIndex: 1,
        cycleStartDate: '2026-06-01',
        cycleEndDate: '2026-07-31',
        interestRate: 6,
        rateSource: 'fixed_rate',
        nominalValueBeforeInterest: 10000,
        interestEarned: 100,
        taxDeducted: 0,
        netInterest: 100,
        nominalValueAfterInterest: 10100,
        accumulatedNetInterest: 0,
        totalValue: 10100,
        realValue: 9990,
        netProfit: 100,
        earlyWithdrawalValue: 10070,
        isMaturity: false,
        isWithdrawal: false,
        cumulativeInflation: 1.01,
        events: [
          {
            type: SimulationEventType.INTEREST_ACCRUAL,
            date: '2026-07-31',
            description: 'Accrual',
          },
        ],
      },
    ] as unknown as YearlyTimelinePoint[];

    const csv = convertComparisonToCSV(timelineA, timelineB, headers, 'en');

    expect(csv).toContain('Scenario A Real Value');
    expect(csv).toContain('Scenario B Interest Payment');
    expect(csv).toContain('"2026-06-30"');
    expect(csv).toContain('"2026-07-31"');
    expect(csv).toContain('Scenario A Rate Source');
    expect(csv).toContain('Scenario B Rate Source');
    expect(csv).toContain('Scenario A Events');
    expect(csv).toContain('Scenario B Events');
    expect(csv).toContain('Historical NBP + margin');
    expect(csv).toContain('Fixed bond rate');
    expect(csv).toContain('Payout');
    expect(csv).toContain('Interest accrual');
  });

  it('keeps comparison export rows useful when only one scenario has a date', () => {
    const headers = buildComparisonExportHeaders((key) => translateMessage('en', key));
    const timelineA = [
      {
        periodLabel: 'Start',
        cycleIndex: 1,
        cycleStartDate: '2026-06-01',
        cycleEndDate: '2026-06-01',
        interestRate: 5.25,
        rateSource: 'first_year_fixed',
        nominalValueBeforeInterest: 10000,
        interestEarned: 0,
        taxDeducted: 0,
        netInterest: 0,
        nominalValueAfterInterest: 10000,
        accumulatedNetInterest: 0,
        totalValue: 10000,
        realValue: 10000,
        netProfit: 0,
        earlyWithdrawalValue: 10000,
        isMaturity: false,
        isWithdrawal: false,
        cumulativeInflation: 1,
        events: [
          { type: SimulationEventType.PURCHASE, date: '2026-06-01', description: 'Purchase' },
        ],
      },
    ] as unknown as YearlyTimelinePoint[];
    const timelineB = [] as unknown as YearlyTimelinePoint[];

    const csv = convertComparisonToCSV(timelineA, timelineB, headers, 'en');

    expect(csv).toContain('"2026-06-01"');
    expect(csv).toContain('"Scenario A"');
    expect(csv).toContain('First-year fixed rate');
    expect(csv).toContain('Purchase');
  });
});
