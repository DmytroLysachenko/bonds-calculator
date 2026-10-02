import { differenceInDays, parseISO } from 'date-fns';
import { Decimal } from 'decimal.js';

import type { BondDefinition } from '../constants/bond-definitions';
import type { BondInputs, CalculationResult } from '../types';
import type { BondComparisonScenarioItem } from '../types/scenarios';
import { SimulationEventType } from '../types/simulation';
import { calculateBondInvestment } from '../utils/calculations';
import { priceIndexPathForProjection } from '../utils/engine/price-index';
import { calculateCAGR } from '../utils/engine/real-return';

import { shouldAutoRollover } from './rollover';

function retainMaturityProceedsAsCash(
  result: CalculationResult,
  inputs: BondInputs,
): CalculationResult {
  const horizonDate = parseISO(inputs.withdrawalDate);
  const maturityDate = parseISO(result.maturityDate);
  if (horizonDate.getTime() <= maturityDate.getTime()) return result;
  const purchaseDate = parseISO(inputs.purchaseDate);
  const last = result.timeline.at(-1);
  if (!last) return result;

  const factor = priceIndexPathForProjection(
    purchaseDate,
    inputs.expectedInflation,
    inputs.customInflation,
  ).factorBetween(purchaseDate, horizonDate);
  const net = new Decimal(result.netPayoutValue);
  const real = net.dividedBy(factor);
  const years = differenceInDays(horizonDate, purchaseDate) / 365.25;
  const finalWithdrawal = last.events?.find(
    (event) => event.type === SimulationEventType.WITHDRAWAL,
  );
  const maturityCheckpoint = {
    ...last,
    isWithdrawal: false,
    events: last.events?.filter((event) => event.type !== SimulationEventType.WITHDRAWAL),
  };
  const cashCheckpoint = {
    ...last,
    year: years,
    periodLabel: 'Cash after maturity',
    cycleStartDate: maturityDate.toISOString(),
    cycleEndDate: horizonDate.toISOString(),
    interestRate: 0,
    rateSource: 'cash_after_maturity' as const,
    rateReferenceValue: undefined,
    rateMarginApplied: 0,
    usedProjectedRate: false,
    nominalValueBeforeInterest: net.toNumber(),
    interestEarned: 0,
    taxDeducted: 0,
    netInterest: 0,
    nominalValueAfterInterest: net.toNumber(),
    totalValue: net.toNumber(),
    realValue: real.toNumber(),
    netProfit: net.minus(inputs.initialInvestment).toNumber(),
    earlyWithdrawalValue: net.toNumber(),
    cumulativeInflation: factor.toNumber(),
    isMaturity: false,
    isWithdrawal: true,
    isProjected: false,
    events: [
      {
        type: SimulationEventType.WITHDRAWAL,
        date: horizonDate.toISOString(),
        description: 'Withdrawal of zero-rate cash held since maturity',
        value: finalWithdrawal?.value ?? net.toNumber(),
      },
    ],
  };

  return {
    ...result,
    timeline: [...result.timeline.slice(0, -1), maturityCheckpoint, cashCheckpoint],
    finalRealValue: real.toNumber(),
    nominalAnnualizedReturn: calculateCAGR(
      new Decimal(inputs.initialInvestment),
      net,
      years,
    ).toNumber(),
    realAnnualizedReturn: calculateCAGR(
      new Decimal(inputs.initialInvestment),
      real,
      years,
    ).toNumber(),
  };
}

export function calculateComparisonScenarioItem({
  inputs,
  definition,
  expectedInflation,
  maturityMode,
  couponDisposition,
  scenarioKey,
  offerTerms,
}: {
  inputs: BondInputs;
  definition: BondDefinition;
  expectedInflation: BondInputs['expectedInflation'];
  maturityMode?:
    | 'hold_to_maturity'
    | 'reinvest_until_horizon'
    | 'cash_after_maturity'
    | 'align_to_shorter_duration';
  couponDisposition?: 'reinvest' | 'cash';
  scenarioKey?: BondComparisonScenarioItem['scenarioKey'];
  offerTerms?: BondComparisonScenarioItem['offerTerms'];
}): BondComparisonScenarioItem {
  const rollover =
    maturityMode === 'reinvest_until_horizon'
      ? true
      : maturityMode === 'cash_after_maturity' || maturityMode === 'hold_to_maturity'
        ? false
        : shouldAutoRollover(inputs, definition.duration);
  const calculated = calculateBondInvestment({
    ...inputs,
    expectedInflation,
    rollover,
    couponDisposition,
  } as BondInputs & { rollover: boolean });
  const result =
    maturityMode === 'cash_after_maturity'
      ? retainMaturityProceedsAsCash(calculated, { ...inputs, expectedInflation })
      : calculated;

  return {
    scenarioKey,
    offerTerms,
    type: inputs.bondType,
    name: definition.fullName.en,
    strategyPolicy:
      maturityMode === 'cash_after_maturity' ||
      maturityMode === 'hold_to_maturity' ||
      maturityMode === 'reinvest_until_horizon'
        ? maturityMode
        : rollover
          ? 'reinvest_until_horizon'
          : 'hold_to_maturity',
    result,
  };
}
