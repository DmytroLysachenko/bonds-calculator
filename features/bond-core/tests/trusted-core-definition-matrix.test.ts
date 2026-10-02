import { describe, expect, it } from 'vitest';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import { BondType, InterestPayout } from '../types';

const expectedOffers: Record<
  BondType,
  {
    duration: number;
    firstYearRate: number;
    margin: number;
    payoutFrequency: InterestPayout;
    isInflationIndexed: boolean;
    earlyWithdrawalFee: number;
  }
> = {
  OTS: {
    duration: 0.25,
    firstYearRate: 2,
    margin: 0,
    payoutFrequency: InterestPayout.MATURITY,
    isInflationIndexed: false,
    earlyWithdrawalFee: 0,
  },
  ROR: {
    duration: 1,
    firstYearRate: 4,
    margin: 0,
    payoutFrequency: InterestPayout.MONTHLY,
    isInflationIndexed: false,
    earlyWithdrawalFee: 0.5,
  },
  DOR: {
    duration: 2,
    firstYearRate: 4.15,
    margin: 0.15,
    payoutFrequency: InterestPayout.MONTHLY,
    isInflationIndexed: false,
    earlyWithdrawalFee: 0.7,
  },
  TOS: {
    duration: 3,
    firstYearRate: 4.4,
    margin: 0,
    payoutFrequency: InterestPayout.MATURITY,
    isInflationIndexed: false,
    earlyWithdrawalFee: 0.7,
  },
  COI: {
    duration: 4,
    firstYearRate: 4.75,
    margin: 1.5,
    payoutFrequency: InterestPayout.YEARLY,
    isInflationIndexed: true,
    earlyWithdrawalFee: 0.7,
  },
  ROS: {
    duration: 6,
    firstYearRate: 5,
    margin: 2,
    payoutFrequency: InterestPayout.MATURITY,
    isInflationIndexed: true,
    earlyWithdrawalFee: 2,
  },
  EDO: {
    duration: 10,
    firstYearRate: 5.35,
    margin: 2,
    payoutFrequency: InterestPayout.MATURITY,
    isInflationIndexed: true,
    earlyWithdrawalFee: 3,
  },
  ROD: {
    duration: 12,
    firstYearRate: 5.6,
    margin: 2.5,
    payoutFrequency: InterestPayout.MATURITY,
    isInflationIndexed: true,
    earlyWithdrawalFee: 3,
  },
};

describe('trusted-core bond-definition matrix', () => {
  it('keeps every supported offer calculator-ready and internally consistent', () => {
    for (const type of Object.values(BondType)) {
      const definition = BOND_DEFINITIONS[type];

      expect(definition.type).toBe(type);
      expect(definition.nominalValue).toBe(100);
      expect(definition.duration).toBeGreaterThan(0);
      expect(definition.firstYearRate).toBeGreaterThanOrEqual(0);
      expect(definition.margin).toBeGreaterThanOrEqual(0);
      expect(definition.earlyWithdrawalFee).toBeGreaterThanOrEqual(0);
      expect(definition.fullName.en).not.toBe('');
      expect(definition.fullName.pl).not.toBe('');

      expect(definition).toMatchObject({ nominalValue: 100, ...expectedOffers[type] });

      if (definition.isInflationIndexed) {
        expect(definition.duration).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
