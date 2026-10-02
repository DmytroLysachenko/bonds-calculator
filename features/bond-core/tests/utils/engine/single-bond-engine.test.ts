import { describe, expect, it } from 'vitest';

import { BOND_DEFINITIONS } from '../../../constants/bond-definitions';
import { BondInputs, BondType, TaxStrategy } from '../../../types';
import { SimulationEventType } from '../../../types/simulation';
import { calculateBondInvestment } from '../../../utils/engine/single-bond-engine';

function singlePayload(overrides: Partial<BondInputs> = {}): BondInputs {
  const definition = BOND_DEFINITIONS[overrides.bondType ?? BondType.EDO];

  return {
    bondType: overrides.bondType ?? BondType.EDO,
    initialInvestment: 10000,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3.5,
    expectedNbpRate: 5.25,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate: '2026-06-16',
    withdrawalDate: '2036-06-16',
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'exact',
    investmentHorizonMonths: 120,
    ...overrides,
  };
}

function eventTypes(result: ReturnType<typeof calculateBondInvestment>) {
  return result.timeline.flatMap((point) => point.events?.map((event) => event.type) ?? []);
}

describe('single bond cycle engine', () => {
  it('applies the ROR first/later issuer fee rule and reconciles paid coupons with redemption cash', () => {
    // ROR1225 issuer explanation: first-period fee is limited to accrued
    // interest, while later-period 0.50 PLN may be taken from principal.
    // https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-roczne-ror/ror1225/
    const base = singlePayload({
      bondType: BondType.ROR,
      initialInvestment: 100,
      firstYearRate: 5.25,
      expectedNbpRate: 5.25,
      margin: 0,
      duration: 1,
      earlyWithdrawalFee: 0.5,
      redemptionFeeCap: 'first-interest-then-principal',
      isCapitalized: false,
      payoutFrequency: BOND_DEFINITIONS[BondType.ROR].payoutFrequency,
      purchaseDate: '2026-06-01',
      investmentHorizonMonths: 1,
    });

    const first = calculateBondInvestment({ ...base, withdrawalDate: '2026-06-14' });
    expect(first.totalEarlyWithdrawalFee).toBeCloseTo((100 * 0.0525 * 13) / 365, 8);
    expect(first.totalTax).toBe(0);
    expect(first.netPayoutValue).toBeCloseTo(100, 8);

    const later = calculateBondInvestment({ ...base, withdrawalDate: '2026-07-14' });
    const firstCouponGross = (100 * 0.0525) / 12;
    const firstCouponTax = 0.09; // 0.44 PLN rounded taxable base × 19%, rounded up.
    const secondPeriodGross = (100 * 0.0525 * 13) / 365;
    const expectedTotal = 100 + firstCouponGross - firstCouponTax + secondPeriodGross - 0.5;
    expect(later.totalEarlyWithdrawalFee).toBe(0.5);
    expect(later.totalTax).toBe(firstCouponTax);
    expect(later.netPayoutValue).toBeCloseTo(expectedTotal, 8);
    const cashEvents = later.timeline.flatMap((point) => point.events ?? []);
    const coupons = cashEvents.filter((event) => event.type === SimulationEventType.PAYOUT);
    const withdrawal = cashEvents.find((event) => event.type === SimulationEventType.WITHDRAWAL);
    expect(coupons).toHaveLength(1);
    expect(coupons[0].value).toBeCloseTo(firstCouponGross - firstCouponTax, 8);
    expect(withdrawal?.value).toBeCloseTo(100 + secondPeriodGross - 0.5, 8);
    expect((coupons[0].value ?? 0) + (withdrawal?.value ?? 0)).toBeCloseTo(later.netPayoutValue, 8);

    const exempt = calculateBondInvestment({
      ...base,
      taxStrategy: TaxStrategy.IKE,
      withdrawalDate: '2026-07-14',
    });
    expect(
      exempt.timeline
        .flatMap((point) => point.events ?? [])
        .some((event) => event.type === SimulationEventType.PAYOUT),
    ).toBe(true);
  });

  it('keeps the terminal point as a withdrawal checkpoint', () => {
    const result = calculateBondInvestment(singlePayload());
    const finalPoint = result.timeline.at(-1);

    expect(finalPoint?.isWithdrawal).toBe(true);
    expect(finalPoint?.events?.map((event) => event.type)).toContain(
      SimulationEventType.WITHDRAWAL,
    );
    expect(result.netPayoutValue).toBeGreaterThan(10000);
    expect(result.finalRealValue).toBeGreaterThan(0);
    expect(result.noteDiagnostics).toContainEqual({
      code: 'rollover_disabled',
      severity: 'assumption',
    });
  });

  it('records rollover purchases across multiple short bond cycles', () => {
    const definition = BOND_DEFINITIONS[BondType.ROR];
    const result = calculateBondInvestment(
      singlePayload({
        bondType: BondType.ROR,
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        duration: definition.duration,
        earlyWithdrawalFee: definition.earlyWithdrawalFee,
        isCapitalized: definition.isCapitalized,
        payoutFrequency: definition.payoutFrequency,
        withdrawalDate: '2028-06-16',
        investmentHorizonMonths: 24,
        rollover: true,
        isRebought: true,
        rebuyDiscount: definition.rebuyDiscount,
      }),
    );

    expect(eventTypes(result)).toContain(SimulationEventType.ROLLOVER_PURCHASE);
    expect(result.timeline.some((point) => point.cycleIndex === 2)).toBe(true);
    expect(result.calculationNotes?.join(' ')).toContain('2 bond cycles');
    expect(result.noteDiagnostics).toContainEqual({
      code: 'rollover_cycles',
      severity: 'assumption',
      params: { count: 2 },
    });
  });

  it('keeps leftover cash outside whole-bond purchase events', () => {
    const definition = BOND_DEFINITIONS[BondType.ROR];
    const result = calculateBondInvestment(
      singlePayload({
        bondType: BondType.ROR,
        initialInvestment: 150,
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        duration: definition.duration,
        earlyWithdrawalFee: definition.earlyWithdrawalFee,
        isCapitalized: definition.isCapitalized,
        payoutFrequency: definition.payoutFrequency,
        withdrawalDate: '2027-06-16',
        investmentHorizonMonths: 12,
      }),
    );
    const purchaseEvent = result.timeline
      .flatMap((point) => point.events ?? [])
      .find(
        (event) =>
          event.type === SimulationEventType.PURCHASE && event.description.includes('bonds'),
      );

    expect(purchaseEvent?.value).toBe(100);
    expect(result.netPayoutValue).toBeGreaterThan(150);
  });

  it('records the initial purchase once rather than repeating it at the first accrual checkpoint', () => {
    const definition = BOND_DEFINITIONS[BondType.EDO];
    const result = calculateBondInvestment(
      singlePayload({
        bondType: BondType.EDO,
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        duration: definition.duration,
        earlyWithdrawalFee: definition.earlyWithdrawalFee,
        isCapitalized: definition.isCapitalized,
        payoutFrequency: definition.payoutFrequency,
        withdrawalDate: '2036-06-16',
        investmentHorizonMonths: 120,
      }),
    );

    const purchaseEvents = result.timeline
      .flatMap((point) => point.events ?? [])
      .filter((event) => event.type === SimulationEventType.PURCHASE);

    expect(purchaseEvents).toHaveLength(1);
    expect(purchaseEvents[0].date).toBe(result.timeline[0].cycleEndDate);
  });

  it('records early redemption fees before native maturity', () => {
    const definition = BOND_DEFINITIONS[BondType.COI];
    const result = calculateBondInvestment(
      singlePayload({
        bondType: BondType.COI,
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        duration: definition.duration,
        earlyWithdrawalFee: definition.earlyWithdrawalFee,
        isCapitalized: definition.isCapitalized,
        payoutFrequency: definition.payoutFrequency,
        withdrawalDate: '2027-06-16',
        investmentHorizonMonths: 12,
      }),
    );

    expect(eventTypes(result)).toContain(SimulationEventType.EARLY_REDEMPTION_FEE);
    expect(result.totalEarlyWithdrawalFee).toBeGreaterThan(0);
    expect(result.calculationNotes?.join(' ')).toContain('Early redemption fee');
    expect(result.noteDiagnostics).toContainEqual({
      code: 'early_redemption_applied',
      severity: 'assumption',
    });
  });

  it('carries IKZE relief as parameterized evidence alongside legacy notes', () => {
    const result = calculateBondInvestment(
      singlePayload({ taxStrategy: TaxStrategy.IKZE, ikzeTaxBracket: 0.12 }),
    );
    expect(result.noteDiagnostics).toContainEqual({
      code: 'ikze_tax_relief',
      severity: 'assumption',
      params: { refund: '1200.00', bracket: 12 },
    });
    expect(result.calculationNotes?.[0]).toContain('IKZE Tax Relief applied');
  });

  it('marks custom CPI reset segments as projected rate data', () => {
    const result = calculateBondInvestment(
      singlePayload({
        customInflation: [3.5, 4.5],
        withdrawalDate: '2028-06-16',
        investmentHorizonMonths: 24,
      }),
    );

    expect(result.dataQualityFlags).toContain('projected_rate_segment');
    expect(result.timeline.some((point) => point.usedProjectedRate)).toBe(true);
    expect(eventTypes(result)).toContain(SimulationEventType.RATE_RESET);
  });

  it('preserves floating-rate source fields and final tax checkpoint', () => {
    const definition = BOND_DEFINITIONS[BondType.ROR];
    const result = calculateBondInvestment(
      singlePayload({
        bondType: BondType.ROR,
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        duration: definition.duration,
        earlyWithdrawalFee: definition.earlyWithdrawalFee,
        isCapitalized: definition.isCapitalized,
        payoutFrequency: definition.payoutFrequency,
        withdrawalDate: '2027-06-16',
        investmentHorizonMonths: 12,
        customNbpRate: [5.25],
      }),
    );
    const resetPoint = result.timeline.find((point) => point.rateSource === 'projected_nbp');
    const finalPoint = result.timeline.at(-1);

    expect(resetPoint).toMatchObject({
      rateReferenceValue: 5.25,
      rateMarginApplied: definition.margin,
      usedProjectedRate: true,
    });
    expect(finalPoint?.isWithdrawal).toBe(true);
    expect(finalPoint?.taxDeducted).toBeGreaterThanOrEqual(0);
    expect(finalPoint?.totalValue).toBeCloseTo(result.netPayoutValue, 8);
  });

  it('keeps early-exit checkpoint values below withdrawal value after fee', () => {
    const definition = BOND_DEFINITIONS[BondType.EDO];
    const result = calculateBondInvestment(
      singlePayload({
        bondType: BondType.EDO,
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        duration: definition.duration,
        earlyWithdrawalFee: definition.earlyWithdrawalFee,
        isCapitalized: definition.isCapitalized,
        payoutFrequency: definition.payoutFrequency,
        withdrawalDate: '2028-06-16',
        investmentHorizonMonths: 24,
      }),
    );
    const finalPoint = result.timeline.at(-1);

    expect(result.isEarlyWithdrawal).toBe(true);
    expect(result.totalEarlyWithdrawalFee).toBeGreaterThan(0);
    expect(finalPoint?.earlyWithdrawalValue).toBeLessThanOrEqual(finalPoint?.totalValue ?? 0);
    expect(finalPoint?.events?.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        SimulationEventType.EARLY_REDEMPTION_FEE,
        SimulationEventType.WITHDRAWAL,
      ]),
    );
  });
});
