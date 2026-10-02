import { addMonths, differenceInDays, isAfter, isBefore, parseISO } from 'date-fns';
import { Decimal } from 'decimal.js';

import {
  BondType,
  InterestPayout,
  LotBreakdown,
  RegularInvestmentInputs,
  TaxStrategy,
} from '../../types';

import { evaluateIssuerPeriod } from './issuer-period-evaluator';
import { calculateEarlyWithdrawalFee, type RedemptionFeeCap } from './redemption';
import {
  calculateTaxAmount,
  settlementPolicyFor,
  shouldWithholdPeriodicTax,
} from './tax-settlement';

export function updateRegularInvestmentLotsForMonth({
  lots,
  currentMonthDate,
  isTerminalWithdrawal,
  bondType,
  firstYearRate,
  expectedInflation,
  expectedNbpRate,
  margin,
  isInflationIndexed,
  customInflation,
  customNbpRate,
  historicalData,
  isCapitalized,
  payoutFrequency,
  taxStrategy,
  taxRate,
  bondPrice,
  nominalValue,
  earlyWithdrawalFee,
  redemptionFeeCap,
}: {
  lots: LotBreakdown[];
  currentMonthDate: Date;
  isTerminalWithdrawal: boolean;
  bondType: BondType;
  firstYearRate: number;
  expectedInflation: RegularInvestmentInputs['expectedInflation'];
  expectedNbpRate: number;
  margin: number;
  isInflationIndexed: boolean;
  customInflation?: number[];
  customNbpRate?: number[];
  historicalData?: RegularInvestmentInputs['historicalData'];
  isCapitalized: boolean;
  payoutFrequency: InterestPayout;
  taxStrategy: TaxStrategy;
  taxRate: number;
  bondPrice: Decimal.Value;
  nominalValue: Decimal.Value;
  earlyWithdrawalFee: number;
  redemptionFeeCap?: RedemptionFeeCap;
}) {
  lots.forEach((lot) => {
    if (lot.settledValue !== undefined) {
      return;
    }
    const lotPurchaseDate = parseISO(lot.purchaseDate);
    const lotMaturityDate = parseISO(lot.maturityDate);

    if (!isAfter(currentMonthDate, lotPurchaseDate)) {
      return;
    }

    const issuerPeriodMonths =
      bondType === BondType.ROR || bondType === BondType.DOR
        ? 1
        : bondType === BondType.OTS
          ? 3
          : 12;
    const completedPeriods = lot.issuerCompletedPeriods ?? 0;
    let nextCompletedPeriods = completedPeriods;
    let nextPrincipal = new Decimal(lot.grossValue);
    let completedInterest = new Decimal(lot.issuerAccruedInterest ?? 0);
    const dLotTax = new Decimal(lot.tax);
    const shouldWithholdTaxForLot = shouldWithholdPeriodicTax(taxStrategy, isCapitalized);
    let nextTax = dLotTax;
    let terminalUnpaidInterest = new Decimal(0);

    // Settle only newly completed natural issuer periods. The monthly plan
    // merely asks for a valuation; it never converts annual products into
    // monthly compounding. This is bounded by newly crossed periods, not by
    // the age of every lot.
    while (true) {
      const periodStart = addMonths(lotPurchaseDate, nextCompletedPeriods * issuerPeriodMonths);
      const scheduledEnd = addMonths(periodStart, issuerPeriodMonths);
      const periodEnd = isAfter(scheduledEnd, lotMaturityDate) ? lotMaturityDate : scheduledEnd;
      if (isAfter(periodEnd, currentMonthDate)) break;

      const period = {
        startDate: periodStart,
        endDate: periodEnd,
        daysInPeriod: differenceInDays(scheduledEnd, periodStart),
        daysHeld: differenceInDays(periodEnd, periodStart),
        isMaturity: periodEnd.getTime() === lotMaturityDate.getTime(),
        isWithdrawal: false,
        periodLabel: '',
      };
      const evaluated = evaluateIssuerPeriod({
        period,
        cyclePurchaseDate: lotPurchaseDate,
        simulationStartDate: lotPurchaseDate,
        bondType,
        firstYearRate,
        expectedInflation,
        expectedNbpRate,
        margin,
        isInflationIndexed,
        customInflation,
        customNbpRate,
        historicalData,
        currentNominalValue: nextPrincipal,
        payoutFrequency,
      });
      completedInterest = completedInterest.plus(evaluated.interestEarned);
      if (isCapitalized) nextPrincipal = nextPrincipal.plus(evaluated.interestEarned);
      if (
        isTerminalWithdrawal &&
        !period.isMaturity &&
        periodEnd.getTime() === currentMonthDate.getTime()
      ) {
        terminalUnpaidInterest = evaluated.interestEarned;
      }
      if (
        shouldWithholdTaxForLot &&
        !(
          isTerminalWithdrawal &&
          !period.isMaturity &&
          periodEnd.getTime() === currentMonthDate.getTime()
        )
      ) {
        nextTax = nextTax.plus(
          calculateTaxAmount(
            evaluated.interestEarned,
            taxStrategy,
            settlementPolicyFor(taxStrategy),
            taxRate,
          ),
        );
      }
      nextCompletedPeriods += 1;
      lot.ratePeriodIndex = nextCompletedPeriods - 1;
      lot.lockedAnnualRate = evaluated.rateContext.currentInterestRate.toNumber();
      if (period.isMaturity) break;
    }

    const previewStart = addMonths(lotPurchaseDate, nextCompletedPeriods * issuerPeriodMonths);
    const previewEnd = isAfter(currentMonthDate, lotMaturityDate)
      ? lotMaturityDate
      : currentMonthDate;
    let previewInterest = new Decimal(0);
    if (isAfter(previewEnd, previewStart)) {
      const scheduledEnd = addMonths(previewStart, issuerPeriodMonths);
      const evaluated = evaluateIssuerPeriod({
        period: {
          startDate: previewStart,
          endDate: previewEnd,
          daysInPeriod: differenceInDays(scheduledEnd, previewStart),
          daysHeld: differenceInDays(previewEnd, previewStart),
          isMaturity: previewEnd.getTime() === lotMaturityDate.getTime(),
          isWithdrawal: false,
          periodLabel: '',
        },
        cyclePurchaseDate: lotPurchaseDate,
        simulationStartDate: lotPurchaseDate,
        bondType,
        firstYearRate,
        expectedInflation,
        expectedNbpRate,
        margin,
        isInflationIndexed,
        customInflation,
        customNbpRate,
        historicalData,
        currentNominalValue: nextPrincipal,
        payoutFrequency,
      });
      previewInterest = evaluated.interestEarned;
      lot.ratePeriodIndex = nextCompletedPeriods;
      lot.lockedAnnualRate = evaluated.rateContext.currentInterestRate.toNumber();
    }

    const currentUnpaidInterest = terminalUnpaidInterest.plus(previewInterest);

    lot.issuerCompletedPeriods = nextCompletedPeriods;
    lot.issuerAccruedInterest = completedInterest.toNumber();
    lot.grossValue = nextPrincipal.toNumber();
    lot.accumulatedInterest = (
      isCapitalized ? previewInterest : completedInterest.plus(previewInterest)
    ).toNumber();
    lot.tax = nextTax.toNumber();
    const totalInterest = completedInterest.plus(previewInterest);

    lot.isMatured = !isBefore(currentMonthDate, lotMaturityDate);

    const dFinalAccumulatedInterest = new Decimal(lot.accumulatedInterest);
    const units = new Decimal(lot.investedAmount).dividedBy(bondPrice).floor();
    const nominalStarting = units.times(nominalValue);
    const isLotEarlyWithdrawal = !lot.isMatured;
    const dFinalFee = calculateEarlyWithdrawalFee(
      bondType,
      isLotEarlyWithdrawal,
      isLotEarlyWithdrawal,
      isCapitalized ? totalInterest : currentUnpaidInterest,
      units,
      earlyWithdrawalFee,
      redemptionFeeCap,
      terminalUnpaidInterest.gt(0) ? Math.max(0, nextCompletedPeriods - 1) : nextCompletedPeriods,
    );
    lot.earlyWithdrawalFee = dFinalFee.toNumber();

    const currentGrossValue = isCapitalized
      ? new Decimal(lot.grossValue).plus(dFinalAccumulatedInterest)
      : units.times(nominalValue).plus(dFinalAccumulatedInterest);
    const currentTaxPaid = shouldWithholdTaxForLot
      ? nextTax.plus(
          calculateTaxAmount(
            Decimal.max(0, currentUnpaidInterest.minus(dFinalFee)),
            taxStrategy,
            settlementPolicyFor(taxStrategy),
            taxRate,
          ),
        )
      : calculateTaxAmount(
          Decimal.max(
            0,
            taxStrategy === TaxStrategy.IKZE
              ? currentGrossValue.minus(dFinalFee)
              : (isCapitalized ? currentGrossValue.minus(nominalStarting) : totalInterest).minus(
                  dFinalFee,
                ),
          ),
          taxStrategy,
          settlementPolicyFor(taxStrategy),
          taxRate,
        );

    lot.netValue = currentGrossValue.minus(currentTaxPaid).minus(dFinalFee).toNumber();
    if (isTerminalWithdrawal || !shouldWithholdTaxForLot) {
      lot.tax = currentTaxPaid.toNumber();
    }
  });
}

export function summarizeRegularInvestmentLots({
  lots,
  bondPrice,
  nominalValue,
  isCapitalized,
}: {
  lots: LotBreakdown[];
  bondPrice: Decimal.Value;
  nominalValue: Decimal.Value;
  isCapitalized: boolean;
}) {
  return lots.reduce(
    (summary, lot) => {
      // A matured lot has been moved to the cash account exactly once. Its
      // immutable history remains available for the lot table but it cannot
      // also be counted as an active holding.
      if (lot.isMatured) {
        return summary;
      }
      const units = new Decimal(lot.investedAmount).dividedBy(bondPrice).floor();
      const nominalStarting = units.times(nominalValue);

      return {
        nominalValue: summary.nominalValue.plus(
          isCapitalized
            ? new Decimal(lot.grossValue).plus(new Decimal(lot.accumulatedInterest))
            : nominalStarting.plus(new Decimal(lot.accumulatedInterest)),
        ),
        profit: summary.profit.plus(new Decimal(lot.netValue).minus(lot.investedAmount)),
        tax: summary.tax.plus(lot.tax),
        fees: summary.fees.plus(lot.earlyWithdrawalFee),
      };
    },
    {
      nominalValue: new Decimal(0),
      profit: new Decimal(0),
      tax: new Decimal(0),
      fees: new Decimal(0),
    },
  );
}
