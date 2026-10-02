import { isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

import { RegularInvestmentInputs } from '@/features/bond-core/types';

export type RegularInvestmentGuardrail = {
  id: 'date-order' | 'future-purchase-date' | 'whole-bond-quantity';
  severity: 'blocking' | 'caution';
  title: string;
  description: string;
};

export function getRegularInvestmentGuardrails(
  inputs: Pick<RegularInvestmentInputs, 'purchaseDate' | 'withdrawalDate' | 'contributionAmount'>,
): RegularInvestmentGuardrail[] {
  const purchaseDate = parseISO(inputs.purchaseDate);
  const withdrawalDate = parseISO(inputs.withdrawalDate);
  const issues: RegularInvestmentGuardrail[] = [];

  if (isBefore(withdrawalDate, purchaseDate)) {
    issues.push({
      id: 'date-order',
      severity: 'blocking',
      title: 'Withdrawal before the first contribution',
      description: 'Choose a withdrawal date on or after the first planned contribution.',
    });
  }

  if (isAfter(purchaseDate, startOfDay(new Date()))) {
    issues.push({
      id: 'future-purchase-date',
      severity: 'caution',
      title: 'Future contribution date',
      description:
        'Forward-dated plans are allowed, but cannot be checked against historical data.',
    });
  }

  if (inputs.contributionAmount < 100 || inputs.contributionAmount % 100 !== 0) {
    issues.push({
      id: 'whole-bond-quantity',
      severity: 'blocking',
      title: 'Contribution must buy whole bonds',
      description: 'Polish retail bonds have a 100 PLN nominal value for each bond.',
    });
  }

  return issues;
}
