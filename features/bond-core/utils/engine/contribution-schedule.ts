import { addMonths, format, isAfter, isBefore, parseISO } from 'date-fns';

import { InvestmentFrequency, RegularInvestmentInputs } from '../../types';

export interface ScheduledContribution {
  date: string;
  amount: number;
  kind: 'initial' | 'base' | 'override' | 'top_up';
}

const intervalFor = (frequency: InvestmentFrequency) =>
  frequency === InvestmentFrequency.MONTHLY
    ? 1
    : frequency === InvestmentFrequency.QUARTERLY
      ? 3
      : 12;

/** Normalizes declarative plan inputs into deterministic external cash flows. */
export function buildContributionSchedule(
  inputs: RegularInvestmentInputs,
): ScheduledContribution[] {
  const start = parseISO(inputs.purchaseDate);
  const end = parseISO(inputs.withdrawalDate);
  const skipped = new Set(inputs.skippedContributionDates ?? []);
  const overrides = new Map(
    (inputs.contributionOverrides ?? []).map((item) => [item.date, item.amount]),
  );
  const flows = new Map<string, ScheduledContribution>();
  const add = (date: string, amount: number, kind: ScheduledContribution['kind']) => {
    if (amount <= 0) return;
    const prior = flows.get(date);
    flows.set(date, {
      date,
      amount: (prior?.amount ?? 0) + amount,
      kind: prior?.kind === 'top_up' ? 'top_up' : kind,
    });
  };
  if ((inputs.initialLumpSum ?? 0) > 0) add(inputs.purchaseDate, inputs.initialLumpSum!, 'initial');
  for (
    let month = 0;
    month < inputs.investmentHorizonMonths;
    month += intervalFor(inputs.frequency)
  ) {
    const date = format(addMonths(start, month), 'yyyy-MM-dd');
    if (skipped.has(date)) continue;
    const annualFactor = Math.pow(
      1 + (inputs.annualContributionIncreasePercent ?? 0) / 100,
      Math.floor(month / 12),
    );
    add(
      date,
      overrides.get(date) ?? Number((inputs.contributionAmount * annualFactor).toFixed(2)),
      overrides.has(date) ? 'override' : 'base',
    );
  }
  for (const topUp of inputs.oneOffContributions ?? []) {
    const date = parseISO(topUp.date);
    if (!isBefore(date, start) && !isAfter(date, end)) add(topUp.date, topUp.amount, 'top_up');
  }
  return [...flows.values()].sort((a, b) => a.date.localeCompare(b.date));
}
