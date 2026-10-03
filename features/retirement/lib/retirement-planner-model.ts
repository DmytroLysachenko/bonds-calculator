import {
  RETIREMENT_SUPPORTED_BOND_TYPES,
  supportsRetirementBondType,
} from '@/features/bond-core/support-matrix';
import { BondType, TaxStrategy } from '@/features/bond-core/types';
import { RetirementPlannerCalculationEnvelope } from '@/features/bond-core/types/scenarios';
import { formatHorizonMonths } from '@/shared/lib/format-horizon';

type Translate = (key: string, values?: Record<string, string | number>) => string;
type AppLanguage = 'pl' | 'en';

export function getSupportedRetirementBondType(bondType: BondType) {
  return supportsRetirementBondType(bondType) ? bondType : BondType.EDO;
}

export function createRetirementChartData(results: RetirementPlannerCalculationEnvelope | null) {
  return (
    results?.result.timeline
      .filter((_, index, timeline) => index % 12 === 0 || index === timeline.length - 1)
      .map((point) => ({
        year: point.year,
        date: point.date,
        balance: point.balance,
        withdrawal: point.withdrawal,
      })) ?? []
  );
}

export function createRetirementScenarioCoverage(
  results: RetirementPlannerCalculationEnvelope | null,
  language: AppLanguage,
) {
  if (!results) {
    return null;
  }

  const finalMonth = results.result.timeline[results.result.timeline.length - 1];
  if (!finalMonth) {
    return null;
  }

  return formatHorizonMonths(finalMonth.year * 12 + finalMonth.month, language);
}

export function createRetirementPlannerLabels(t: Translate) {
  return {
    pageTitle: t('retirement_page.page_title'),
    pageDescription: t('retirement_page.page_description'),
    primaryInputs: t('retirement_page.primary_inputs'),
    primaryInputsDesc: t('retirement_page.primary_inputs_description'),
    initialCapital: t('retirement_page.initial_capital'),
    monthlyWithdrawal: t('retirement_page.monthly_withdrawal'),
    scenarioHorizon: t('retirement_page.scenario_horizon'),
    bondFamily: t('retirement_page.bond_family'),
    advancedAssumptions: t('retirement_page.advanced_assumptions'),
    advancedAssumptionsDesc: t('retirement_page.advanced_assumptions_description'),
    expectedInflation: t('retirement_page.expected_inflation'),
    expectedNbpRate: t('retirement_page.expected_nbp_rate'),
    taxWrapper: t('retirement_page.tax_wrapper'),
    floatingActionNote: t('retirement_page.floating_action_note'),
    staleResults: t('retirement_page.stale_results'),
    scenarioStatus: t('retirement_page.scenario_status'),
    balancePositive: t('retirement_page.balance_positive'),
    balanceDepletes: t('retirement_page.balance_depletes'),
    projectedExhaustion: t('retirement_page.projected_exhaustion'),
    noProjectedDepletion: t('retirement_page.no_projected_depletion'),
    finalBalance: t('retirement_page.final_balance'),
    finalBalanceDetail: t('retirement_page.final_balance_detail'),
    totalWithdrawn: t('retirement_page.total_withdrawn'),
    totalWithdrawnDetail: t('retirement_page.total_withdrawn_detail'),
    modeledAnnualRate: t('retirement_page.modeled_annual_rate'),
    modeledAnnualRateDetail: t('retirement_page.modeled_annual_rate_detail'),
    balancePath: t('retirement_page.balance_path'),
    balancePathDesc: t('retirement_page.balance_path_description'),
    coverage: t('retirement_page.coverage'),
    taxPaid: t('retirement_page.tax_paid'),
    howToRead: t('retirement_page.how_to_read'),
    howToReadDesc: t('retirement_page.how_to_read_description'),
    balance: t('retirement_page.balance'),
    withdrawal: t('retirement_page.withdrawal'),
    date: t('retirement_page.date'),
    monthlyTable: t('retirement_page.monthly_table'),
    monthlyTableDesc: t('retirement_page.monthly_table_description'),
    assumptionsAndWarnings: t('retirement_page.assumptions_and_warnings'),
    assumptionsAndWarningsDesc: t('retirement_page.assumptions_and_warnings_description'),
    audit: t('retirement_page.audit'),
    assumptions: t('retirement_page.assumptions'),
    warningsAndNotes: t('retirement_page.warnings_and_notes'),
    noExtraAssumptions: t('retirement_page.no_extra_assumptions'),
    noExtraWarnings: t('retirement_page.no_extra_warnings'),
    readyBadge: t('retirement_page.ready_badge'),
    readyTitle: t('retirement_page.ready_title'),
    readyDesc: t('retirement_page.ready_description'),
    readyStepBalance: t('retirement_page.ready_steps.balance_path'),
    readyStepHorizon: t('retirement_page.ready_steps.commit_horizon'),
    readyStepRead: t('retirement_page.ready_steps.read_narrowly'),
    readyStepReadDesc: t('retirement_page.ready_steps.read_narrowly_description'),
    readyFooter: t('retirement_page.ready_footer'),
    limitsTitle: t('retirement_page.limits_title'),
    limitsDesc: t('retirement_page.limits_description'),
    limitsBadge: t('retirement_page.limits_badge'),
    depletionWarning: t('retirement_page.depletion_warning'),
  } as const;
}

export function createRetirementTaxStrategyLabels(t: Translate): Record<TaxStrategy, string> {
  return {
    [TaxStrategy.STANDARD]: t('retirement_page.tax_strategy.standard'),
    [TaxStrategy.IKE]: t('retirement_page.tax_strategy.ike'),
    [TaxStrategy.IKZE]: t('retirement_page.tax_strategy.ikze'),
  };
}

export function createRetirementModelLimits(t: Translate) {
  return [
    t('retirement_page.model_limits.steady_rate'),
    t('retirement.supported_bonds_limit', {
      bondTypes: RETIREMENT_SUPPORTED_BOND_TYPES.join(', '),
    }),
    t('retirement_page.model_limits.scope'),
  ];
}

export function getRetirementTaxStrategyLabel(
  taxStrategyLabels: Record<TaxStrategy, string>,
  taxStrategy: TaxStrategy,
) {
  return taxStrategyLabels[taxStrategy];
}
