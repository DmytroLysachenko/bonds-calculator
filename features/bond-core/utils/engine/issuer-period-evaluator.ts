import { Decimal } from 'decimal.js';

import { BondInputs, BondType, HistoricalDataMap, InterestPayout } from '../../types';
import { SimulationEvent } from '../../types/simulation';

import { calculatePeriodAccrual } from './accrual';
import { createInterestAccrualEvent, createRateResetEvent } from './single-bond-events';
import { resolveSingleBondPeriodRateState } from './single-bond-period-rate';
import { TimelinePeriod } from './timeline-builder';

/**
 * Evaluates one issuer-defined interest period. Both the single-bond and
 * recurring engines use this seam: scheduling may differ, but rate resets and
 * date-aware accrual must not.
 */
export interface EvaluateIssuerPeriodInput {
  period: TimelinePeriod;
  cyclePurchaseDate: Date;
  simulationStartDate: Date;
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
  payoutFrequency: InterestPayout;
}

export function evaluateIssuerPeriod({
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
}: EvaluateIssuerPeriodInput) {
  const events: SimulationEvent[] = [];
  const periodRateState = resolveSingleBondPeriodRateState({
    periodStartDate: period.startDate,
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
  });
  const { rateContext } = periodRateState;

  if (rateContext.shouldRecordRateReset && rateContext.rateResetDescription) {
    events.push(
      createRateResetEvent(
        period.startDate,
        rateContext.rateResetDescription,
        rateContext.currentInterestRate,
      ),
    );
  }

  const accrual = calculatePeriodAccrual(
    currentNominalValue,
    rateContext.currentInterestRate,
    period.daysHeld,
    period.daysInPeriod,
    bondType,
    payoutFrequency,
    period.startDate,
  );
  const interestEarned = accrual.interestEarned;
  const previousNominalValue = new Decimal(currentNominalValue);

  if (interestEarned.gt(0)) {
    events.push(createInterestAccrualEvent(period.endDate, interestEarned));
  }

  return { periodRateState, rateContext, events, interestEarned, previousNominalValue };
}
