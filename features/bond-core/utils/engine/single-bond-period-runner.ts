import { differenceInMonths } from 'date-fns';
import { Decimal } from 'decimal.js';

import { BondInputs, BondType, HistoricalDataMap, InterestPayout, TaxStrategy } from '../../types';
import { SimulationEvent } from '../../types/simulation';

import { priceIndexPathForProjection } from './price-index';
import type { RedemptionFeeCap } from './redemption';
import { resolveSingleBondCheckpointValues } from './single-bond-accounting';
import { createSingleBondCheckpoint } from './single-bond-checkpoint';
import {
  createCyclePurchaseEvent,
  createEarlyRedemptionFeeEvent,
  createFinalTaxSettlementEvent,
  createMaturityEvent,
  createPayoutEvent,
  createPeriodicTaxSettlementEvent,
  createWithdrawalEvent,
} from './single-bond-events';
import { resolveSingleBondPeriodAccrualStep } from './single-bond-period-step';
import {
  calculateTaxAmount,
  settlementPolicyFor,
  shouldWithholdPeriodicTax,
} from './tax-settlement';
import { TimelinePeriod } from './timeline-builder';

interface RunSingleBondPeriodInput {
  period: TimelinePeriod;
  isFirstPeriod: boolean;
  simulationStartDate: Date;
  targetWithdrawalDate: Date;
  cyclePurchaseDate: Date;
  cycleIndex: number;
  bondType: BondType;
  firstYearRate: number;
  expectedInflation: BondInputs['expectedInflation'];
  expectedNbpRate: number;
  margin: number;
  isInflationIndexed: boolean;
  customInflation?: number[];
  customNbpRate?: number[];
  historicalData?: HistoricalDataMap;
  currentNominalValue: Decimal;
  totalInterestEarnedSoFar: Decimal;
  periodicTaxPaidSoFar: Decimal;
  globalAccumulatedNetInterest: Decimal;
  numberOfBonds: Decimal;
  nominalStartingValue: Decimal;
  earlyWithdrawalFee: number;
  redemptionFeeCap?: RedemptionFeeCap;
  isCapitalized: boolean;
  payoutFrequency: InterestPayout;
  isEarlyWithdrawal: boolean;
  taxStrategy: TaxStrategy;
  taxRate: number;
  initialInvestment: number;
  leftoverCash: Decimal;
  couponDisposition?: 'reinvest' | 'cash';
}

export function runSingleBondPeriod({
  period,
  isFirstPeriod,
  simulationStartDate,
  targetWithdrawalDate,
  cyclePurchaseDate,
  cycleIndex,
  bondType,
  firstYearRate,
  expectedInflation,
  expectedNbpRate,
  margin,
  isInflationIndexed,
  customInflation,
  customNbpRate,
  historicalData,
  currentNominalValue,
  totalInterestEarnedSoFar,
  periodicTaxPaidSoFar,
  globalAccumulatedNetInterest,
  numberOfBonds,
  nominalStartingValue,
  earlyWithdrawalFee,
  redemptionFeeCap,
  isCapitalized,
  payoutFrequency,
  isEarlyWithdrawal,
  taxStrategy,
  taxRate,
  initialInvestment,
  leftoverCash,
  couponDisposition,
}: RunSingleBondPeriodInput) {
  let nextCurrentNominalValue = currentNominalValue;
  let nextTotalInterestEarnedSoFar = totalInterestEarnedSoFar;
  let nextPeriodicTaxPaidSoFar = periodicTaxPaidSoFar;
  let nextGlobalAccumulatedNetInterest = globalAccumulatedNetInterest;
  const periodStep = resolveSingleBondPeriodAccrualStep({
    period,
    cyclePurchaseDate,
    simulationStartDate,
    bondType,
    firstYearRate,
    expectedInflation,
    expectedNbpRate,
    margin,
    isInflationIndexed,
    customInflation,
    customNbpRate,
    historicalData,
    currentNominalValue,
    payoutFrequency,
  });
  const events: SimulationEvent[] = [];

  if (isFirstPeriod && cycleIndex > 1) {
    events.push(
      createCyclePurchaseEvent({
        cycleIndex,
        date: period.startDate,
        numberOfBonds,
        nominalStartingValue,
      }),
    );
  }
  events.push(...periodStep.events);

  const { periodRateState, rateContext } = periodStep;
  const {
    currentInterestRate,
    rateSource,
    rateReferenceValue,
    rateMarginApplied,
    usedProjectedRate,
  } = rateContext;

  const { interestEarned, previousNominalValue } = periodStep;
  nextTotalInterestEarnedSoFar = nextTotalInterestEarnedSoFar.plus(interestEarned);

  let taxDeducted = new Decimal(0);
  if (shouldWithholdPeriodicTax(taxStrategy, isCapitalized)) {
    if (!period.isWithdrawal || !isEarlyWithdrawal) {
      taxDeducted = calculateTaxAmount(
        interestEarned,
        taxStrategy,
        settlementPolicyFor(taxStrategy),
        taxRate,
      );
      nextPeriodicTaxPaidSoFar = nextPeriodicTaxPaidSoFar.plus(taxDeducted);
      if (taxDeducted.gt(0))
        events.push(createPeriodicTaxSettlementEvent(period.endDate, taxDeducted));
    }
  } else if (isCapitalized) {
    nextCurrentNominalValue = nextCurrentNominalValue.plus(interestEarned);
  }

  const couponWasPaid = !isCapitalized && !(period.isWithdrawal && isEarlyWithdrawal);
  if (couponWasPaid && interestEarned.gt(0)) {
    events.push(createPayoutEvent(period.endDate, interestEarned.minus(taxDeducted)));
  }

  const netInterest = interestEarned.minus(taxDeducted);
  nextGlobalAccumulatedNetInterest = nextGlobalAccumulatedNetInterest.plus(netInterest);

  const cumulativeInflation = priceIndexPathForProjection(
    simulationStartDate,
    expectedInflation,
    customInflation,
  ).factorBetween(simulationStartDate, period.endDate);
  const totalMonthsSoFar = differenceInMonths(period.endDate, simulationStartDate);

  const checkpointValues = resolveSingleBondCheckpointValues({
    bondType,
    isEarlyWithdrawal,
    isWithdrawal: period.isWithdrawal,
    isMaturity: period.isMaturity,
    totalInterestEarnedSoFar: nextTotalInterestEarnedSoFar,
    currentPeriodInterest: interestEarned,
    numberOfBonds,
    earlyWithdrawalFee,
    redemptionFeeCap,
    issuerPeriodIndex: isFirstPeriod ? 0 : 1,
    isCapitalized,
    currentNominalValue: nextCurrentNominalValue,
    nominalStartingValue,
    taxStrategy,
    taxRate,
    periodicTaxPaidSoFar: nextPeriodicTaxPaidSoFar,
    cumulativeInflation,
    initialInvestment,
    leftoverCash,
  });

  if (period.isWithdrawal && isEarlyWithdrawal && checkpointValues.currentWithdrawalFee.gt(0)) {
    events.push(
      createEarlyRedemptionFeeEvent(period.endDate, checkpointValues.currentWithdrawalFee),
    );
  }

  if (
    period.isWithdrawal &&
    checkpointValues.currentTaxAtPoint.minus(nextPeriodicTaxPaidSoFar).gt(0)
  ) {
    events.push(
      createFinalTaxSettlementEvent(
        period.endDate,
        checkpointValues.currentTaxAtPoint.minus(nextPeriodicTaxPaidSoFar),
      ),
    );
  }

  if (period.isMaturity) {
    events.push(createMaturityEvent(period.endDate));
  }

  if (period.isWithdrawal) {
    const previouslyPaidCoupons = isCapitalized
      ? new Decimal(0)
      : nextTotalInterestEarnedSoFar
          .minus(couponWasPaid ? 0 : interestEarned)
          .minus(nextPeriodicTaxPaidSoFar);
    events.push(
      createWithdrawalEvent(
        period.endDate,
        checkpointValues.currentGrossValue
          .minus(checkpointValues.currentWithdrawalFee)
          .minus(checkpointValues.currentTaxAtPoint)
          .minus(previouslyPaidCoupons),
      ),
    );
  }

  return {
    checkpoint: createSingleBondCheckpoint({
      totalMonthsSoFar,
      periodLabel: period.periodLabel,
      cycleIndex,
      cycleStartDate: cyclePurchaseDate,
      periodEndDate: period.endDate,
      currentInterestRate,
      rateSource,
      rateReferenceValue,
      rateMarginApplied,
      usedProjectedRate,
      previousNominalValue,
      interestEarned,
      taxDeducted,
      netInterest,
      currentNominalPrincipal: checkpointValues.currentNominalPrincipal,
      globalAccumulatedNetInterest: nextGlobalAccumulatedNetInterest,
      totalValue: checkpointValues.totalValue,
      realValue: checkpointValues.realValue,
      checkpointNetProfit: checkpointValues.checkpointNetProfit,
      hypotheticalEarlyExitValue: checkpointValues.hypotheticalEarlyExitValue,
      cumulativeInflation,
      isMaturity: period.isMaturity,
      isWithdrawal: period.endDate.getTime() === targetWithdrawalDate.getTime(),
      inflationReference: periodRateState.inflationReference,
      nbpReference: periodRateState.nbpReference,
      events,
    }),
    currentNominalValue: nextCurrentNominalValue,
    totalInterestEarnedSoFar: nextTotalInterestEarnedSoFar,
    currentPeriodInterest: interestEarned,
    periodicTaxPaidSoFar: nextPeriodicTaxPaidSoFar,
    globalAccumulatedNetInterest: nextGlobalAccumulatedNetInterest,
    dataQualityFlag: usedProjectedRate ? 'projected_rate_segment' : null,
    couponCashAdded:
      couponDisposition === 'cash' && !isCapitalized && !period.isWithdrawal
        ? netInterest
        : new Decimal(0),
  };
}
