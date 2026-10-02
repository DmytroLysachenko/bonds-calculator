import { addMonths, format, isAfter, parseISO } from 'date-fns';
import { Decimal } from 'decimal.js';

import { BondType, InvestmentFrequency, LotBreakdown } from '../../types';
import { SimulationEvent, SimulationEventType } from '../../types/simulation';

export function getRegularInvestmentInterval(frequency: InvestmentFrequency) {
  if (frequency === InvestmentFrequency.MONTHLY) {
    return 1;
  }
  return frequency === InvestmentFrequency.QUARTERLY ? 3 : 12;
}

export function settleMaturedLots(
  lots: LotBreakdown[],
  currentMonthDate: Date,
  events: SimulationEvent[],
) {
  let maturedLiquidity = new Decimal(0);

  lots.forEach((lot) => {
    const lotMaturityDate = parseISO(lot.maturityDate);
    if (
      lot.settledValue === undefined &&
      (currentMonthDate.getTime() === lotMaturityDate.getTime() ||
        isAfter(currentMonthDate, lotMaturityDate))
    ) {
      lot.isMatured = true;
      lot.settledValue = lot.netValue;
      maturedLiquidity = maturedLiquidity.plus(lot.netValue);
      events.push({
        type: SimulationEventType.MATURITY,
        date: format(currentMonthDate, 'yyyy-MM-dd'),
        description: `Lot from ${lot.purchaseDate} matured`,
        value: lot.netValue,
      });
    }
  });

  return maturedLiquidity;
}

interface CreateRegularInvestmentLotInput {
  currentMonthDate: Date;
  bondType: BondType;
  bondDuration: number;
  nominalValue: number;
  bondPrice: Decimal;
  availableCash: Decimal;
}

export function createRegularInvestmentLot({
  currentMonthDate,
  bondType,
  bondDuration,
  nominalValue,
  bondPrice,
  availableCash,
}: CreateRegularInvestmentLotInput) {
  const units = availableCash.dividedBy(bondPrice).floor();
  const investedAmount = units.times(bondPrice);
  const nominalAmount = units.times(nominalValue);

  if (!units.gt(0)) {
    return { lot: null, investedAmount, units };
  }

  const lotDuration = bondType === BondType.OTS ? 0.25 : bondDuration;
  const lotMaturityDate = addMonths(currentMonthDate, Math.round(lotDuration * 12));

  return {
    units,
    investedAmount,
    lot: {
      purchaseDate: format(currentMonthDate, 'yyyy-MM-dd'),
      maturityDate: format(lotMaturityDate, 'yyyy-MM-dd'),
      isMatured: false,
      investedAmount: investedAmount.toNumber(),
      accumulatedInterest: 0,
      tax: 0,
      earlyWithdrawalFee: 0,
      grossValue: nominalAmount.toNumber(),
      netValue: nominalAmount.toNumber(),
    } satisfies LotBreakdown,
  };
}
