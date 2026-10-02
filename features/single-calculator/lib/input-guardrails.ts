import { isFamilyBondType } from '@/features/bond-core/support-matrix';
import { BondInputs, TaxStrategy } from '@/features/bond-core/types';
import { getHorizonMonths, getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

type GuardrailSeverity = 'info' | 'caution' | 'blocking';

export interface InputGuardrailIssue {
  id: string;
  severity: GuardrailSeverity;
  title: string;
  description: string;
  field?: keyof BondInputs;
  autoFixLabel?: string;
  applyAutoFix?: (inputs: BondInputs) => BondInputs;
}

function getBondYearLimit(strategy: TaxStrategy) {
  const year = new Date().getFullYear();
  if (strategy === TaxStrategy.IKE) {
    return year >= 2026 ? 26019 : 23847;
  }

  if (strategy === TaxStrategy.IKZE) {
    return year >= 2026 ? 10407.6 : 9388.8;
  }

  return null;
}

export function getInputGuardrails(
  inputs: BondInputs,
  _translate?: (key: string, params?: Record<string, string | number>) => string,
): InputGuardrailIssue[] {
  void _translate;
  const issues: InputGuardrailIssue[] = [];
  const horizonMonths =
    inputs.investmentHorizonMonths ?? getHorizonMonths(inputs.purchaseDate, inputs.withdrawalDate);
  const purchase = new Date(inputs.purchaseDate);
  const withdrawal = new Date(inputs.withdrawalDate);
  const today = new Date();
  const yearWindowLimit = getBondYearLimit(inputs.taxStrategy);

  if (inputs.initialInvestment < 100) {
    issues.push({
      id: 'minimum-investment',
      severity: 'blocking',
      field: 'initialInvestment',
      title: 'Minimum purchase too low',
      description: 'Retail bond simulations assume at least 100 PLN nominal purchase.',
      autoFixLabel: 'Set to 100 PLN',
      applyAutoFix: (current) => ({ ...current, initialInvestment: 100 }),
    });
  }

  if (inputs.initialInvestment >= 100 && inputs.initialInvestment % 100 !== 0) {
    issues.push({
      id: 'whole-bond-quantity',
      severity: 'blocking',
      field: 'initialInvestment',
      title: 'Purchase amount is not a whole number of bonds',
      description:
        'Polish retail bonds have a 100 PLN nominal value, so the purchase amount must be divisible by 100.',
      autoFixLabel: 'Round down to whole bonds',
      applyAutoFix: (current) => ({
        ...current,
        initialInvestment: Math.floor(current.initialInvestment / 100) * 100,
      }),
    });
  }

  if (withdrawal.getTime() < purchase.getTime()) {
    issues.push({
      id: 'date-order',
      severity: 'blocking',
      field: 'withdrawalDate',
      title: 'Withdrawal before purchase',
      description: 'Withdrawal date must be on or after purchase date.',
      autoFixLabel: 'Align withdrawal date',
      applyAutoFix: (current) => ({
        ...current,
        withdrawalDate: getWithdrawalDateFromMonths(
          current.purchaseDate,
          current.investmentHorizonMonths ?? 1,
        ),
      }),
    });
  }

  if (purchase.getTime() > today.getTime()) {
    issues.push({
      id: 'future-purchase-date',
      severity: 'caution',
      field: 'purchaseDate',
      title: 'Purchase date is in future',
      description:
        'Forward-dated assumptions are allowed, but they stop being historical validation scenarios.',
    });
  }

  if (horizonMonths < 1) {
    issues.push({
      id: 'horizon-too-short',
      severity: 'blocking',
      field: 'investmentHorizonMonths',
      title: 'Investment horizon too short',
      description: 'Simulation needs at least 1 month of holding period.',
      autoFixLabel: 'Set 1 month',
      applyAutoFix: (current) => ({
        ...current,
        investmentHorizonMonths: 1,
        withdrawalDate: getWithdrawalDateFromMonths(current.purchaseDate, 1),
      }),
    });
  }

  if (horizonMonths > 360) {
    issues.push({
      id: 'horizon-too-long',
      severity: 'caution',
      field: 'investmentHorizonMonths',
      title: 'Very long horizon',
      description:
        '30+ year projections amplify macro assumption error. Treat as directional, not precise.',
    });
  }

  if (inputs.expectedInflation < -10 || inputs.expectedInflation > 25) {
    issues.push({
      id: 'inflation-extreme',
      severity: 'caution',
      field: 'expectedInflation',
      title: 'Extreme inflation assumption',
      description:
        'Scenario is mathematically allowed, but interpretation becomes much less stable.',
    });
  }

  if ((inputs.expectedNbpRate ?? 0) < -5 || (inputs.expectedNbpRate ?? 0) > 20) {
    issues.push({
      id: 'nbp-extreme',
      severity: 'caution',
      field: 'expectedNbpRate',
      title: 'Extreme NBP rate assumption',
      description: 'Reference-rate projection sits far outside common planning range.',
    });
  }

  if (yearWindowLimit && inputs.initialInvestment > yearWindowLimit && inputs.useTaxWrapperLimit) {
    issues.push({
      id: 'tax-wrapper-limit',
      severity: 'info',
      field: 'initialInvestment',
      title: 'Wrapper limit overflow expected',
      description: `Amount exceeds annual ${inputs.taxStrategy} limit. Overflow will spill into taxable balance.`,
    });
  }

  if (isFamilyBondType(inputs.bondType) && inputs.taxStrategy === TaxStrategy.STANDARD) {
    issues.push({
      id: 'family-bond-standard',
      severity: 'info',
      field: 'bondType',
      title: 'Family bond selected',
      description:
        'ROS and ROD are family-targeted products. Keep assumptions realistic for household planning use.',
    });
  }

  if (
    inputs.savingsGoal &&
    inputs.calculatorMode === 'reverse' &&
    inputs.initialInvestment > inputs.savingsGoal
  ) {
    issues.push({
      id: 'goal-smaller-than-capital',
      severity: 'info',
      field: 'savingsGoal',
      title: 'Goal below starting capital',
      description: 'Reverse mode works, but target is already below starting amount.',
    });
  }

  return issues;
}

export function applyGuardrailFix(issue: InputGuardrailIssue, inputs: BondInputs): BondInputs {
  return issue.applyAutoFix ? issue.applyAutoFix(inputs) : inputs;
}
