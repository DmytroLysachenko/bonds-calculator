import { format } from 'date-fns';
import { Decimal } from 'decimal.js';

import {
  CalculationResult,
  RegularInvestmentResult,
  RegularTimelinePoint,
  YearlyTimelinePoint,
} from '../../types';

import { calculateCAGR } from './real-return';

interface SingleBondResultParams {
  startDate: Date;
  firstYearRate: number;
  initialInvestment: number;
  expectedInflation: number;
  expectedNbpRate: number;
}

export function createInitialTimelinePoint({
  startDate,
  firstYearRate,
  initialInvestment,
  expectedInflation,
  expectedNbpRate,
}: SingleBondResultParams): YearlyTimelinePoint {
  return {
    year: 0,
    periodLabel: format(startDate, 'MMM yyyy'),
    cycleIndex: 0,
    cycleStartDate: startDate.toISOString(),
    cycleEndDate: startDate.toISOString(),
    interestRate: firstYearRate,
    rateSource: 'initial_principal',
    rateReferenceValue: undefined,
    rateMarginApplied: 0,
    usedProjectedRate: false,
    nominalValueBeforeInterest: initialInvestment,
    interestEarned: 0,
    taxDeducted: 0,
    netInterest: 0,
    nominalValueAfterInterest: initialInvestment,
    accumulatedNetInterest: 0,
    totalValue: initialInvestment,
    realValue: initialInvestment,
    netProfit: 0,
    // At purchase no interest has accrued, so the statutory early-exit fee
    // is zero (it cannot exceed accrued interest). The investor can recover
    // the full invested amount at this initial checkpoint.
    earlyWithdrawalValue: initialInvestment,
    cumulativeInflation: 1,
    isMaturity: false,
    isWithdrawal: false,
    isProjected: false,
    inflationReference: expectedInflation,
    nbpReference: expectedNbpRate,
  };
}

interface FinalSingleBondResultParams {
  initialInvestment: number;
  timeline: YearlyTimelinePoint[];
  cycleNetProceeds: Decimal;
  totalTax: Decimal;
  totalFee: Decimal;
  isEarlyWithdrawal: boolean;
  cycleMaturityDate: Date;
  totalHorizonYears: number;
  calculationNotes?: string[];
  noteDiagnostics?: CalculationResult['noteDiagnostics'];
  dataQualityFlags?: string[];
}

export function createFinalSingleBondResult({
  initialInvestment,
  timeline,
  cycleNetProceeds,
  totalTax,
  totalFee,
  isEarlyWithdrawal,
  cycleMaturityDate,
  totalHorizonYears,
  calculationNotes = [],
  noteDiagnostics = [],
  dataQualityFlags = [],
}: FinalSingleBondResultParams): CalculationResult {
  const lastPoint = timeline[timeline.length - 1];
  const aggregateGrossValue = cycleNetProceeds.plus(totalTax).plus(totalFee);

  const nominalAnnualizedReturn = calculateCAGR(
    new Decimal(initialInvestment),
    cycleNetProceeds,
    totalHorizonYears,
  ).toNumber();

  const realAnnualizedReturn = calculateCAGR(
    new Decimal(initialInvestment),
    new Decimal(lastPoint.realValue),
    totalHorizonYears,
  ).toNumber();

  return {
    initialInvestment,
    timeline,
    finalNominalValue: aggregateGrossValue.toNumber(),
    finalRealValue: lastPoint.realValue,
    totalProfit: cycleNetProceeds.minus(initialInvestment).toNumber(),
    totalTax: totalTax.toNumber(),
    totalEarlyWithdrawalFee: totalFee.toNumber(),
    grossValue: aggregateGrossValue.toNumber(),
    netPayoutValue: cycleNetProceeds.toNumber(),
    isEarlyWithdrawal,
    maturityDate: cycleMaturityDate.toISOString(),
    nominalAnnualizedReturn,
    realAnnualizedReturn,
    calculationNotes,
    noteDiagnostics,
    dataQualityFlags,
  };
}

function calculateRealAnnualizedReturn(
  totalHorizon: number,
  realContributions: Decimal,
  lastPoint: RegularTimelinePoint,
): number {
  if (totalHorizon <= 0 || realContributions.lte(0)) {
    return 0;
  }

  const totalMultiplier = new Decimal(lastPoint.realValue).dividedBy(realContributions);
  if (totalMultiplier.lte(0)) {
    return 0;
  }

  return (Math.pow(totalMultiplier.toNumber(), 1 / totalHorizon) - 1) * 100;
}

export function createRegularInvestmentResult(
  totalInvested: Decimal,
  totalHorizon: number,
  timeline: RegularTimelinePoint[],
  lots: RegularInvestmentResult['lots'],
  realContributions = totalInvested,
  cashBalance = new Decimal(0),
  activeHoldingsValue = new Decimal(lastRegularNominalValue(timeline, cashBalance)),
): RegularInvestmentResult {
  const lastPoint = timeline[timeline.length - 1];
  const terminalNetSettlement = lastPoint?.events?.find(
    (event) => event.type === 'WITHDRAWAL',
  )?.value;

  return {
    totalInvested: totalInvested.toNumber(),
    finalNominalValue: lastPoint.nominalValue,
    finalRealValue: lastPoint.realValue,
    totalProfit: lastPoint.profit,
    totalTax: lastPoint.tax,
    totalEarlyWithdrawalFees: lastPoint.earlyWithdrawalFees,
    realAnnualizedReturn: calculateRealAnnualizedReturn(totalHorizon, realContributions, lastPoint),
    moneyWeightedAnnualizedReturn: calculateMoneyWeightedReturn(timeline, lastPoint.nominalValue),
    timeline,
    lots,
    cashBalance: cashBalance.toNumber(),
    totalContributions: totalInvested.toNumber(),
    activeHoldingsValue: activeHoldingsValue.toNumber(),
    terminalNetSettlement,
    paidOutValue: terminalNetSettlement ?? 0,
    terminalWealth: activeHoldingsValue.plus(cashBalance).toNumber(),
  };
}

function calculateMoneyWeightedReturn(timeline: RegularTimelinePoint[], terminalValue: number) {
  const flows = timeline.flatMap((point) =>
    (point.events ?? [])
      .filter((event) => event.type === 'CONTRIBUTION')
      .map((event) => ({ date: new Date(event.date), amount: -(event.value ?? 0) })),
  );
  const terminalDate = new Date(timeline.at(-1)?.date ?? '');
  if (!flows.length || !Number.isFinite(terminalDate.getTime())) return undefined;
  flows.push({ date: terminalDate, amount: terminalValue });
  const origin = flows[0].date.getTime();
  const npv = (rate: number) =>
    flows.reduce(
      (sum, flow) =>
        sum +
        flow.amount / Math.pow(1 + rate, (flow.date.getTime() - origin) / 86_400_000 / 365.25),
      0,
    );
  let low = -0.9999;
  let high = 10;
  if (npv(low) * npv(high) > 0) return undefined;
  for (let index = 0; index < 80; index += 1) {
    const middle = (low + high) / 2;
    if (npv(low) * npv(middle) <= 0) high = middle;
    else low = middle;
  }
  return ((low + high) / 2) * 100;
}

function lastRegularNominalValue(timeline: RegularTimelinePoint[], fallback: Decimal) {
  return timeline.at(-1)?.nominalValue ?? fallback.toNumber();
}
