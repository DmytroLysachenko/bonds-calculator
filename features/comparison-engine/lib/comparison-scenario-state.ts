import { IndependentBondComparisonPayload } from '@/features/bond-core/types/scenarios';
import { getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

type SharedComparisonConfig = IndependentBondComparisonPayload['sharedConfig'];
type ScenarioOverride = IndependentBondComparisonPayload['scenarioA'];

export function sanitizeScenarioOverride(
  sharedConfig: SharedComparisonConfig,
  scenario: ScenarioOverride,
): ScenarioOverride {
  const next: ScenarioOverride = { ...scenario };
  const purchaseDate = next.purchaseDate ?? sharedConfig.purchaseDate;
  const hasCustomHorizon = next.investmentHorizonMonths !== undefined;

  if (!hasCustomHorizon) {
    delete next.investmentHorizonMonths;
    delete next.withdrawalDate;
    delete next.timingMode;
  } else {
    next.timingMode = 'general';
    next.withdrawalDate = getWithdrawalDateFromMonths(
      purchaseDate,
      next.investmentHorizonMonths as number,
    );
  }

  if (next.taxStrategy === sharedConfig.taxStrategy) {
    delete next.taxStrategy;
  }
  if (next.strategyPolicy === sharedConfig.strategyPolicy) delete next.strategyPolicy;
  if (next.couponDisposition === sharedConfig.couponDisposition) delete next.couponDisposition;

  return next;
}

export function toggleScenarioCustomHorizon(
  sharedConfig: SharedComparisonConfig,
  scenario: ScenarioOverride,
  enabled: boolean,
): ScenarioOverride {
  if (!enabled) {
    return sanitizeScenarioOverride(sharedConfig, {
      ...scenario,
      investmentHorizonMonths: undefined,
      withdrawalDate: undefined,
      timingMode: undefined,
    });
  }

  return sanitizeScenarioOverride(sharedConfig, {
    ...scenario,
    investmentHorizonMonths:
      scenario.investmentHorizonMonths ?? sharedConfig.investmentHorizonMonths ?? 120,
  });
}

export function setScenarioCustomHorizonMonths(
  sharedConfig: SharedComparisonConfig,
  scenario: ScenarioOverride,
  investmentHorizonMonths: number | undefined,
): ScenarioOverride {
  return sanitizeScenarioOverride(sharedConfig, {
    ...scenario,
    investmentHorizonMonths,
  });
}
