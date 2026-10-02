import { differenceInDays, isBefore } from 'date-fns';
import { Decimal } from 'decimal.js';

import { BOND_DEFINITIONS } from '../../constants/bond-definitions';
import { createNumericFaultError } from '../../errors';
import { BondInputs, CalculationResult } from '../../types';
import { SimulationEventType } from '../../types/simulation';
import { withMathGuard } from '../engine-guards';

import { normalizeBondInputs } from './input-normalization';
import { createFinalSingleBondResult, createInitialTimelinePoint } from './result-assembly';
import { resolveSingleBondCycleSettlement } from './single-bond-checkpoint';
import {
  resolveNextSingleBondCycleState,
  resolveSingleBondCycleDates,
  resolveSingleBondCycleInvestment,
} from './single-bond-cycle';
import { createCyclePurchaseEvent } from './single-bond-events';
import { runSingleBondPeriod } from './single-bond-period-runner';
import { createSingleBondSimulationState } from './single-bond-simulation-state';
import { applySingleBondTaxRelief } from './single-bond-tax-relief';
import {
  buildSingleBondTerminalDiagnostics,
  buildSingleBondTerminalNotes,
  shouldStopSingleBondSimulation,
} from './single-bond-terminal';
import { generateCyclePeriods } from './timeline-builder';

/**
 * Standard calculation for a single bond investment.
 * Supports "rollover" (re-investing at maturity) for multi-year comparisons.
 */
export const calculateBondInvestment = withMathGuard(function calculateBondInvestment(
  inputs: BondInputs & { rollover?: boolean },
): CalculationResult {
  const rollover = inputs.rollover ?? false;
  const couponDisposition = inputs.couponDisposition ?? 'reinvest';
  const normalizedInputs = normalizeBondInputs(inputs);
  const {
    initialInvestment,
    firstYearRate,
    expectedInflation,
    expectedNbpRate = 5.25,
    margin,
    actualDuration: bondDuration,
    earlyWithdrawalFee,
    redemptionFeeCap,
    bondType,
    isCapitalized,
    payoutFrequency,
    purchaseDate: startDate,
    withdrawalDate: targetWithdrawalDate,
    isRebought,
    rebuyDiscount,
    historicalData,
    taxStrategy,
    taxRate,
    ikzeTaxBracket,
  } = normalizedInputs;

  const taxRelief = applySingleBondTaxRelief({
    initialInvestment,
    taxStrategy,
    ikzeTaxBracket,
  });
  const simulationState = createSingleBondSimulationState({ taxRelief, startDate });

  // Add initial starting point for the whole simulation
  const initialPoint = createInitialTimelinePoint({
    startDate,
    firstYearRate,
    initialInvestment,
    expectedInflation,
    expectedNbpRate,
  });
  initialPoint.events = [
    {
      type: SimulationEventType.PURCHASE,
      date: startDate.toISOString(),
      description: `Initial investment of ${initialInvestment} PLN`,
      value: initialInvestment,
    },
  ];
  simulationState.globalTimeline.push(initialPoint);

  // We loop until we cover the whole simulation period (supporting multiple rollovers)
  while (isBefore(simulationState.currentPurchaseDate, targetWithdrawalDate)) {
    const bondDef = BOND_DEFINITIONS[bondType];
    const isInflationIndexed = bondDef?.isInflationIndexed ?? false;
    const nominalValue = bondDef?.nominalValue ?? 100;

    const { cycleMaturityDate, actualCycleEndDate, isEarlyWithdrawal } =
      resolveSingleBondCycleDates({
        purchaseDate: simulationState.currentPurchaseDate,
        bondDuration,
        targetWithdrawalDate,
      });

    // Investment for THIS cycle = cash from previous cycle + any leftovers
    const totalAvailable = simulationState.currentInitialInvestment.plus(
      simulationState.leftoverCash,
    );
    const cycleInvestment = resolveSingleBondCycleInvestment({
      availableCash: totalAvailable,
      nominalValue,
      rebuyDiscount,
      applySwapDiscountThisCycle: simulationState.applySwapDiscountThisCycle,
    });
    simulationState.leftoverCash = cycleInvestment.leftoverCash;
    const numberOfBonds = cycleInvestment.numberOfBonds;
    const nominalStartingValue = cycleInvestment.nominalStartingValue;

    if (simulationState.cycleIndex === 1) {
      initialPoint.events = [
        createCyclePurchaseEvent({
          cycleIndex: simulationState.cycleIndex,
          date: simulationState.currentPurchaseDate,
          numberOfBonds,
          nominalStartingValue,
        }),
      ];
    }

    let currentNominalValue = new Decimal(nominalStartingValue);
    let totalInterestEarnedSoFar = new Decimal(0);
    let periodicTaxPaidSoFar = new Decimal(0);
    let currentPeriodInterest = new Decimal(0);
    let cycleCouponCash = new Decimal(0);

    const periods = generateCyclePeriods(
      simulationState.currentPurchaseDate,
      cycleMaturityDate,
      actualCycleEndDate,
      payoutFrequency,
    );

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const periodResult = runSingleBondPeriod({
        period,
        isFirstPeriod: i === 0,
        simulationStartDate: startDate,
        targetWithdrawalDate,
        cyclePurchaseDate: simulationState.currentPurchaseDate,
        cycleIndex: simulationState.cycleIndex,
        bondType,
        firstYearRate,
        expectedInflation,
        expectedNbpRate,
        margin,
        isInflationIndexed,
        customInflation: inputs.customInflation,
        customNbpRate: inputs.customNbpRate,
        historicalData,
        currentNominalValue,
        totalInterestEarnedSoFar,
        periodicTaxPaidSoFar,
        globalAccumulatedNetInterest: simulationState.globalAccumulatedNetInterest,
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
        leftoverCash: simulationState.leftoverCash,
        couponDisposition,
      });
      currentNominalValue = periodResult.currentNominalValue;
      totalInterestEarnedSoFar = periodResult.totalInterestEarnedSoFar;
      periodicTaxPaidSoFar = periodResult.periodicTaxPaidSoFar;
      currentPeriodInterest = periodResult.currentPeriodInterest;
      simulationState.globalAccumulatedNetInterest = periodResult.globalAccumulatedNetInterest;
      cycleCouponCash = cycleCouponCash.plus(periodResult.couponCashAdded);
      if (periodResult.dataQualityFlag) {
        simulationState.dataQualityFlags.add(periodResult.dataQualityFlag);
      }

      simulationState.globalTimeline.push(periodResult.checkpoint);

      if (period.isWithdrawal) break;
    }

    const {
      cycleFee,
      cycleTax,
      netProceeds: settledProceeds,
    } = resolveSingleBondCycleSettlement({
      bondType,
      isEarlyWithdrawal,
      totalInterestEarnedSoFar,
      currentPeriodInterest,
      numberOfBonds,
      earlyWithdrawalFee,
      redemptionFeeCap,
      issuerPeriodIndex: Math.max(0, periods.length - 1),
      isCapitalized,
      currentNominalValue,
      nominalStartingValue,
      taxStrategy,
      taxRate,
      periodicTaxPaidSoFar,
      leftoverCash: simulationState.leftoverCash,
    });
    const netProceeds = rollover ? settledProceeds.minus(cycleCouponCash) : settledProceeds;
    if (rollover) simulationState.couponCash = simulationState.couponCash.plus(cycleCouponCash);

    simulationState.totalTaxAcc = simulationState.totalTaxAcc.plus(cycleTax);
    simulationState.totalFeeAcc = simulationState.totalFeeAcc.plus(cycleFee);

    if (
      shouldStopSingleBondSimulation({
        rollover,
        isEarlyWithdrawal,
        actualCycleEndDate,
        targetWithdrawalDate,
      })
    ) {
      const totalHorizonYears = differenceInDays(actualCycleEndDate, startDate) / 365.25;
      simulationState.calculationNotes.push(
        ...buildSingleBondTerminalNotes({
          rollover,
          cycleIndex: simulationState.cycleIndex,
          isEarlyWithdrawal,
        }),
      );
      simulationState.noteDiagnostics.push(
        ...buildSingleBondTerminalDiagnostics({
          rollover,
          cycleIndex: simulationState.cycleIndex,
          isEarlyWithdrawal,
        }),
      );

      return createFinalSingleBondResult({
        initialInvestment,
        timeline: simulationState.globalTimeline,
        cycleNetProceeds: netProceeds.plus(simulationState.couponCash),
        totalTax: simulationState.totalTaxAcc,
        totalFee: simulationState.totalFeeAcc,
        isEarlyWithdrawal,
        cycleMaturityDate,
        totalHorizonYears,
        calculationNotes: simulationState.calculationNotes,
        noteDiagnostics: simulationState.noteDiagnostics,
        dataQualityFlags: Array.from(simulationState.dataQualityFlags),
      });
    }

    const nextCycleState = resolveNextSingleBondCycleState({
      netProceeds,
      actualCycleEndDate,
      isRebought,
      nextCycleIndex: simulationState.cycleIndex + 1,
    });
    simulationState.currentInitialInvestment = nextCycleState.currentInitialInvestment;
    simulationState.leftoverCash = nextCycleState.leftoverCash;
    simulationState.globalAccumulatedNetInterest = nextCycleState.globalAccumulatedNetInterest;
    simulationState.currentPurchaseDate = nextCycleState.currentPurchaseDate;
    simulationState.applySwapDiscountThisCycle = nextCycleState.applySwapDiscountThisCycle;
    simulationState.cycleIndex = nextCycleState.cycleIndex;
  }

  throw createNumericFaultError(
    'Single-bond calculation exited without reaching the selected withdrawal date.',
    {
      details: {
        purchaseDate: startDate.toISOString(),
        withdrawalDate: targetWithdrawalDate.toISOString(),
        timelineLength: simulationState.globalTimeline.length,
        cycleIndex: simulationState.cycleIndex,
      },
    },
  );
});
