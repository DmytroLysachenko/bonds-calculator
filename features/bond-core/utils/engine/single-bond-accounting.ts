import { Decimal } from 'decimal.js';

import { BondType, TaxStrategy } from '../../types';

import { calculateRealValue } from './real-return';
import { calculateEarlyWithdrawalFee, type RedemptionFeeCap } from './redemption';
import {
  calculateTaxAmount,
  settlementPolicyFor,
  shouldWithholdPeriodicTax,
} from './tax-settlement';

interface SingleBondCheckpointValuesInput {
  bondType: BondType;
  isEarlyWithdrawal: boolean;
  isWithdrawal: boolean;
  isMaturity: boolean;
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
  cumulativeInflation: Decimal;
  initialInvestment: number;
  leftoverCash: Decimal;
}

export function resolveSingleBondCheckpointValues({
  bondType,
  isEarlyWithdrawal,
  isWithdrawal,
  isMaturity,
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
  cumulativeInflation,
  initialInvestment,
  leftoverCash,
}: SingleBondCheckpointValuesInput) {
  const currentNominalPrincipal = isCapitalized ? currentNominalValue : nominalStartingValue;
  const currentWithdrawalFee = calculateEarlyWithdrawalFee(
    bondType,
    isEarlyWithdrawal,
    isWithdrawal && isEarlyWithdrawal,
    isCapitalized ? totalInterestEarnedSoFar : currentPeriodInterest,
    numberOfBonds,
    earlyWithdrawalFee,
    redemptionFeeCap,
    issuerPeriodIndex,
  );
  const hypotheticalEarlyExitFee = isMaturity
    ? new Decimal(0)
    : calculateEarlyWithdrawalFee(
        bondType,
        true,
        true,
        isCapitalized ? totalInterestEarnedSoFar : currentPeriodInterest,
        numberOfBonds,
        earlyWithdrawalFee,
        redemptionFeeCap,
        issuerPeriodIndex,
      );
  const currentGrossValue = isCapitalized
    ? currentNominalValue
    : nominalStartingValue.plus(totalInterestEarnedSoFar);
  const currentTaxAtPoint = shouldWithholdPeriodicTax(taxStrategy, isCapitalized)
    ? periodicTaxPaidSoFar.plus(
        isEarlyWithdrawal
          ? calculateTaxAmount(
              Decimal.max(0, currentPeriodInterest.minus(currentWithdrawalFee)),
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
            ? currentGrossValue.minus(currentWithdrawalFee)
            : totalInterestEarnedSoFar.minus(currentWithdrawalFee),
        ),
        taxStrategy,
        settlementPolicyFor(taxStrategy),
        taxRate,
      );
  const liquidationValue = currentGrossValue.minus(currentWithdrawalFee).minus(currentTaxAtPoint);
  // The schedule reports the investor's position if they exit at this point,
  // not merely the cash still locked in the bond. Paid coupons remain theirs
  // and therefore belong in this amount. A coupon bond at a payment checkpoint
  // has no retained interest from which an exit fee can be charged, so the
  // principal is preserved and the already-paid coupons are included.
  const totalValue = liquidationValue.plus(leftoverCash);
  const hypotheticalEarlyExitValue = isCapitalized
    ? currentGrossValue.minus(hypotheticalEarlyExitFee).minus(currentTaxAtPoint).plus(leftoverCash)
    : totalValue;

  return {
    currentNominalPrincipal,
    currentWithdrawalFee,
    currentGrossValue,
    currentTaxAtPoint,
    liquidationValue,
    hypotheticalEarlyExitValue,
    totalValue,
    realValue: calculateRealValue(totalValue, cumulativeInflation),
    checkpointNetProfit: totalValue.minus(initialInvestment),
  };
}
