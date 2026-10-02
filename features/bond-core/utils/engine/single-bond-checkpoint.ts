import { Decimal } from 'decimal.js';

import { BondType, RateSource, TaxStrategy, YearlyTimelinePoint } from '../../types';
import { SimulationEvent } from '../../types/simulation';

import { calculateEarlyWithdrawalFee, type RedemptionFeeCap } from './redemption';
import {
  calculateTaxAmount,
  settlementPolicyFor,
  shouldWithholdPeriodicTax,
} from './tax-settlement';

export function createSingleBondCheckpoint({
  totalMonthsSoFar,
  periodLabel,
  cycleIndex,
  cycleStartDate,
  periodEndDate,
  currentInterestRate,
  rateSource,
  rateReferenceValue,
  rateMarginApplied,
  usedProjectedRate,
  previousNominalValue,
  interestEarned,
  taxDeducted,
  netInterest,
  currentNominalPrincipal,
  globalAccumulatedNetInterest,
  totalValue,
  realValue,
  checkpointNetProfit,
  hypotheticalEarlyExitValue,
  cumulativeInflation,
  isMaturity,
  isWithdrawal,
  inflationReference,
  nbpReference,
  events,
}: {
  totalMonthsSoFar: number;
  periodLabel: string;
  cycleIndex: number;
  cycleStartDate: Date;
  periodEndDate: Date;
  currentInterestRate: Decimal;
  rateSource: RateSource;
  rateReferenceValue?: number;
  rateMarginApplied: number;
  usedProjectedRate: boolean;
  previousNominalValue: Decimal;
  interestEarned: Decimal;
  taxDeducted: Decimal;
  netInterest: Decimal;
  currentNominalPrincipal: Decimal;
  globalAccumulatedNetInterest: Decimal;
  totalValue: Decimal;
  realValue: Decimal;
  checkpointNetProfit: Decimal;
  hypotheticalEarlyExitValue: Decimal;
  cumulativeInflation: Decimal;
  isMaturity: boolean;
  isWithdrawal: boolean;
  inflationReference: number;
  nbpReference: number;
  events: SimulationEvent[];
}): YearlyTimelinePoint {
  return {
    year: totalMonthsSoFar / 12,
    periodLabel,
    cycleIndex,
    cycleStartDate: cycleStartDate.toISOString(),
    cycleEndDate: periodEndDate.toISOString(),
    interestRate: currentInterestRate.toNumber(),
    rateSource,
    rateReferenceValue,
    rateMarginApplied,
    usedProjectedRate,
    nominalValueBeforeInterest: previousNominalValue.toNumber(),
    interestEarned: interestEarned.toNumber(),
    taxDeducted: taxDeducted.toNumber(),
    netInterest: netInterest.toNumber(),
    nominalValueAfterInterest: currentNominalPrincipal.toNumber(),
    accumulatedNetInterest: globalAccumulatedNetInterest.toNumber(),
    totalValue: totalValue.toNumber(),
    realValue: realValue.toNumber(),
    netProfit: checkpointNetProfit.toNumber(),
    earlyWithdrawalValue: Decimal.max(hypotheticalEarlyExitValue, 0).toNumber(),
    cumulativeInflation: cumulativeInflation.toNumber(),
    isMaturity,
    isWithdrawal,
    isProjected: rateSource === 'projected_cpi' || rateSource === 'projected_nbp',
    inflationReference,
    nbpReference,
    events: events.length > 0 ? events : undefined,
  };
}

export function resolveSingleBondCycleSettlement({
  bondType,
  isEarlyWithdrawal,
  totalInterestEarnedSoFar,
  currentPeriodInterest,
  numberOfBonds,
  earlyWithdrawalFee,
  redemptionFeeCap,
  issuerPeriodIndex,
  isCapitalized,
  currentNominalValue,
  nominalStartingValue,
  taxStrategy,
  taxRate,
  periodicTaxPaidSoFar,
  leftoverCash,
}: {
  bondType: BondType;
  isEarlyWithdrawal: boolean;
  totalInterestEarnedSoFar: Decimal;
  currentPeriodInterest: Decimal;
  numberOfBonds: Decimal;
  earlyWithdrawalFee: number;
  redemptionFeeCap?: RedemptionFeeCap;
  issuerPeriodIndex: number;
  isCapitalized: boolean;
  currentNominalValue: Decimal;
  nominalStartingValue: Decimal;
  taxStrategy: TaxStrategy;
  taxRate: number;
  periodicTaxPaidSoFar: Decimal;
  leftoverCash: Decimal;
}) {
  const cycleFee = isEarlyWithdrawal
    ? calculateEarlyWithdrawalFee(
        bondType,
        true,
        true,
        isCapitalized ? totalInterestEarnedSoFar : currentPeriodInterest,
        numberOfBonds,
        earlyWithdrawalFee,
        redemptionFeeCap,
        issuerPeriodIndex,
      )
    : new Decimal(0);
  const cycleGrossValue = isCapitalized
    ? currentNominalValue
    : nominalStartingValue.plus(totalInterestEarnedSoFar);
  const cycleTax = shouldWithholdPeriodicTax(taxStrategy, isCapitalized)
    ? periodicTaxPaidSoFar.plus(
        isEarlyWithdrawal
          ? calculateTaxAmount(
              Decimal.max(0, currentPeriodInterest.minus(cycleFee)),
              taxStrategy,
              settlementPolicyFor(taxStrategy),
              taxRate,
            )
          : 0,
      )
    : calculateTaxAmount(
        Decimal.max(
          0,
          taxStrategy === TaxStrategy.IKZE
            ? cycleGrossValue.minus(cycleFee)
            : totalInterestEarnedSoFar.minus(cycleFee),
        ),
        taxStrategy,
        settlementPolicyFor(taxStrategy),
        taxRate,
      );
  const netProceeds = cycleGrossValue.minus(cycleFee).minus(cycleTax).plus(leftoverCash);

  return {
    cycleFee,
    cycleGrossValue,
    cycleTax,
    netProceeds,
  };
}
