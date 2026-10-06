import { BondType, InterestPayout } from '../types';

export interface BondDefinition {
  type: BondType;
  name: string;
  fullName: {
    en: string;
    pl: string;
  };
  description: {
    en: string;
    pl: string;
  };
  duration: number;
  nominalValue: number;
  isCapitalized: boolean;
  payoutFrequency: InterestPayout;
  firstYearRate: number;
  margin: number;
  earlyWithdrawalFee: number;
  isInflationIndexed: boolean;
  isFloating: boolean;
  isFamilyOnly?: boolean;
  rebuyDiscount: number;
  rateProvenance?: {
    kind: 'issued-series' | 'database-reference' | 'curated-reference';
    /** Issued/curated sale-window start, or database reference record date. */
    asOf?: string;
    seriesCode?: string;
    sourceUrl?: string;
  };
}

// These fallback opening rates and margins match the Ministry's September 2026
// retail-offer table. The date is that sale window's start, not a claim that
// the static values are today's verified offer.
const CURATED_RATE_PROVENANCE = {
  kind: 'curated-reference',
  asOf: '2026-09-01',
  sourceUrl:
    'https://www.gov.pl/web/finanse/podaz-skarbowych-papierow-wartosciowych-we-wrzesniu-2026',
} as const satisfies BondDefinition['rateProvenance'];

export const BOND_DEFINITIONS: Record<BondType, BondDefinition> = {
  [BondType.OTS]: {
    type: BondType.OTS,
    name: 'OTS',
    fullName: {
      en: '3-Month Fixed Rate Savings Bonds',
      pl: 'Oszczędnościowe trzymiesięczne stałooprocentowane',
    },
    description: {
      en: 'Fixed interest rate for the full 3-month term. Best for short-term cash parking.',
      pl: 'Stałe oprocentowanie przez pełne 3 miesiące. Najprostsza opcja dla krótkiego postoju gotówki.',
    },
    duration: 0.25,
    nominalValue: 100,
    isCapitalized: false,
    payoutFrequency: InterestPayout.MATURITY,
    firstYearRate: 2.0,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 0,
    earlyWithdrawalFee: 0,
    isInflationIndexed: false,
    isFloating: false,
    rebuyDiscount: 0,
  },
  [BondType.ROR]: {
    type: BondType.ROR,
    name: 'ROR',
    fullName: {
      en: '1-Year Variable Rate Savings Bonds',
      pl: 'Roczne oszczędnościowe referencyjne',
    },
    description: {
      en: 'Monthly payout bond linked to the NBP reference rate after the first monthly period.',
      pl: 'Obligacja z miesięczną wypłatą odsetek, oparta na stopie referencyjnej NBP po pierwszym okresie.',
    },
    duration: 1,
    nominalValue: 100,
    isCapitalized: false,
    payoutFrequency: InterestPayout.MONTHLY,
    firstYearRate: 4.0,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 0,
    earlyWithdrawalFee: 0.5,
    isInflationIndexed: false,
    isFloating: true,
    rebuyDiscount: 0.1,
  },
  [BondType.DOR]: {
    type: BondType.DOR,
    name: 'DOR',
    fullName: {
      en: '2-Year Variable Rate Savings Bonds',
      pl: 'Dwuletnie oszczędnościowe referencyjne',
    },
    description: {
      en: 'Monthly payout bond linked to the NBP reference rate with a 0.15% margin after the first period.',
      pl: 'Obligacja z miesięczną wypłatą odsetek, oparta na stopie referencyjnej NBP z marżą 0,15 p.p. po pierwszym okresie.',
    },
    duration: 2,
    nominalValue: 100,
    isCapitalized: false,
    payoutFrequency: InterestPayout.MONTHLY,
    firstYearRate: 4.15,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 0.15,
    earlyWithdrawalFee: 0.7,
    isInflationIndexed: false,
    isFloating: true,
    rebuyDiscount: 0.1,
  },
  [BondType.TOS]: {
    type: BondType.TOS,
    name: 'TOS',
    fullName: {
      en: '3-Year Fixed Rate Savings Bonds',
      pl: 'Trzyletnie oszczędnościowe stałooprocentowane',
    },
    description: {
      en: 'Fixed 3-year rate with annual capitalization.',
      pl: 'Stałe oprocentowanie przez 3 lata z roczną kapitalizacją odsetek.',
    },
    duration: 3,
    nominalValue: 100,
    isCapitalized: true,
    payoutFrequency: InterestPayout.MATURITY,
    firstYearRate: 4.4,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 0,
    earlyWithdrawalFee: 0.7,
    isInflationIndexed: false,
    isFloating: false,
    rebuyDiscount: 0.1,
  },
  [BondType.COI]: {
    type: BondType.COI,
    name: 'COI',
    fullName: {
      en: '4-Year Inflation-Indexed Savings Bonds',
      pl: 'Czteroletnie oszczędnościowe indeksowane',
    },
    description: {
      en: 'First year fixed, then yearly inflation plus a 1.50% margin, with annual interest payout.',
      pl: 'Pierwszy rok: stałe oprocentowanie, potem roczna inflacja plus marża 1,50 p.p. z coroczną wypłatą odsetek.',
    },
    duration: 4,
    nominalValue: 100,
    isCapitalized: false,
    payoutFrequency: InterestPayout.YEARLY,
    firstYearRate: 4.75,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 1.5,
    earlyWithdrawalFee: 0.7,
    isInflationIndexed: true,
    isFloating: false,
    rebuyDiscount: 0.1,
  },
  [BondType.ROS]: {
    type: BondType.ROS,
    name: 'ROS',
    fullName: {
      en: '6-Year Family Inflation-Indexed Savings Bonds',
      pl: 'Rodzinne oszczędnościowe sześcioletnie',
    },
    description: {
      en: 'Family bond for 800+ beneficiaries with annual capitalization and inflation plus 2.00% margin after year one.',
      pl: 'Rodzinna obligacja dla beneficjentów 800+ z roczną kapitalizacją i oprocentowaniem: inflacja + 2,00 p.p. po pierwszym roku.',
    },
    duration: 6,
    nominalValue: 100,
    isCapitalized: true,
    payoutFrequency: InterestPayout.MATURITY,
    firstYearRate: 5.0,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 2.0,
    earlyWithdrawalFee: 2.0,
    isInflationIndexed: true,
    isFloating: false,
    isFamilyOnly: true,
    rebuyDiscount: 0,
  },
  [BondType.EDO]: {
    type: BondType.EDO,
    name: 'EDO',
    fullName: {
      en: '10-Year Inflation-Indexed Savings Bonds',
      pl: 'Emerytalne dziesięcioletnie oszczędnościowe',
    },
    description: {
      en: 'First year fixed, then yearly inflation plus a 2.00% margin with annual capitalization.',
      pl: 'Pierwszy rok: stałe oprocentowanie, potem roczna inflacja plus marża 2,00 p.p. z coroczną kapitalizacją odsetek.',
    },
    duration: 10,
    nominalValue: 100,
    isCapitalized: true,
    payoutFrequency: InterestPayout.MATURITY,
    firstYearRate: 5.35,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 2.0,
    earlyWithdrawalFee: 3.0,
    isInflationIndexed: true,
    isFloating: false,
    rebuyDiscount: 0.1,
  },
  [BondType.ROD]: {
    type: BondType.ROD,
    name: 'ROD',
    fullName: {
      en: '12-Year Family Inflation-Indexed Savings Bonds',
      pl: 'Rodzinne oszczędnościowe dwunastoletnie',
    },
    description: {
      en: 'Longest family bond, with annual capitalization and inflation plus a 2.50% margin after year one.',
      pl: 'Najdłuższa obligacja rodzinna z roczną kapitalizacją i oprocentowaniem: inflacja + 2,50 p.p. po pierwszym roku.',
    },
    duration: 12,
    nominalValue: 100,
    isCapitalized: true,
    payoutFrequency: InterestPayout.MATURITY,
    firstYearRate: 5.6,
    rateProvenance: CURATED_RATE_PROVENANCE,
    margin: 2.5,
    earlyWithdrawalFee: 3.0,
    isInflationIndexed: true,
    isFloating: false,
    isFamilyOnly: true,
    rebuyDiscount: 0,
  },
};
