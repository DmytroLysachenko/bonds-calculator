import { RateSource, YearlyTimelinePoint } from '@/features/bond-core/types';
import { SimulationEventType } from '@/features/bond-core/types/simulation';
import { capitalizePolishDateLabel } from '@/i18n/locale-utils';
import { translateMessage } from '@/i18n/translate';
import { createDateFormatter } from '@/shared/lib/formatters';

export type AppLanguage = 'pl' | 'en';
export type CashFlowSemantics = 'payout' | 'retained';

const RATE_SOURCE_KEYS: Record<RateSource, string> = {
  initial_principal: 'bonds.timeline_display.rate_source.initial_principal',
  fixed_rate: 'bonds.timeline_display.rate_source.fixed_rate',
  first_year_fixed: 'bonds.timeline_display.rate_source.first_year_fixed',
  historical_cpi_lag: 'bonds.timeline_display.rate_source.historical_cpi_lag',
  projected_cpi: 'bonds.timeline_display.rate_source.projected_cpi',
  historical_nbp: 'bonds.timeline_display.rate_source.historical_nbp',
  projected_nbp: 'bonds.timeline_display.rate_source.projected_nbp',
  cash_after_maturity: 'bonds.timeline_display.rate_source.cash_after_maturity',
};

const EVENT_LABEL_KEYS: Record<SimulationEventType, string> = {
  CONTRIBUTION: 'bonds.timeline_display.event.contribution',
  PURCHASE: 'bonds.timeline_display.event.purchase',
  RATE_RESET: 'bonds.timeline_display.event.rate_reset',
  INTEREST_ACCRUAL: 'bonds.timeline_display.event.interest_accrual',
  PAYOUT: 'bonds.timeline_display.event.payout',
  TAX_SETTLEMENT: 'bonds.timeline_display.event.tax_settlement',
  EARLY_REDEMPTION_FEE: 'bonds.timeline_display.event.early_redemption_fee',
  ROLLOVER_PURCHASE: 'bonds.timeline_display.event.rollover_purchase',
  MATURITY: 'bonds.timeline_display.event.maturity',
  WITHDRAWAL: 'bonds.timeline_display.event.withdrawal',
};

export function formatMonthYear(date: string, language: AppLanguage) {
  const label = createDateFormatter(language, {
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));

  return capitalizePolishDateLabel(label, language);
}

export function getRateSourceDisplayLabel(source: RateSource, language: AppLanguage) {
  return translateMessage(language, RATE_SOURCE_KEYS[source]);
}

export function getSimulationEventDisplayLabel(type: SimulationEventType, language: AppLanguage) {
  return translateMessage(language, EVENT_LABEL_KEYS[type]);
}

export function getProjectionDisplayLabel(isProjected: boolean | undefined, language: AppLanguage) {
  if (!isProjected) {
    return undefined;
  }
  return translateMessage(language, 'bonds.timeline_display.projection.projected');
}

export function getCadenceDisplayLabel(point: YearlyTimelinePoint, language: AppLanguage) {
  if (
    point.events?.some((event) => event.type === SimulationEventType.PURCHASE) &&
    point.events.length === 1
  ) {
    return translateMessage(language, 'bonds.timeline_display.cadence.scenario_entry');
  }
  if (point.isMaturity) {
    return translateMessage(language, 'bonds.timeline_display.cadence.maturity_closeout');
  }
  if (point.isWithdrawal) {
    return translateMessage(language, 'bonds.timeline_display.cadence.exit_payout');
  }
  if (point.events?.some((event) => event.type === SimulationEventType.PAYOUT)) {
    return translateMessage(language, 'bonds.timeline_display.cadence.payout_rollover');
  }
  return translateMessage(language, 'bonds.timeline_display.cadence.checkpoint');
}

export function inferCashFlowSemantics(timeline: YearlyTimelinePoint[]): CashFlowSemantics {
  return timeline.some((point) =>
    point.events?.some((event) => event.type === SimulationEventType.PAYOUT),
  )
    ? 'payout'
    : 'retained';
}

export function getCashFlowDisplayLabel(semantics: CashFlowSemantics, language: AppLanguage) {
  return translateMessage(
    language,
    semantics === 'payout'
      ? 'bonds.timeline_display.cash_flow.paid_out'
      : 'bonds.timeline_display.cash_flow.retained',
  );
}

export function getCycleDisplayLabel(point: YearlyTimelinePoint, language: AppLanguage) {
  const start = formatMonthYear(point.cycleStartDate, language);
  const end = formatMonthYear(point.cycleEndDate, language);
  return `${translateMessage(language, 'bonds.cycle')} ${point.cycleIndex}: ${start} -> ${end}`;
}

export function getValueMeaningLabel(
  point: YearlyTimelinePoint,
  language: AppLanguage,
  cashFlowSemantics: CashFlowSemantics,
) {
  if (point.isWithdrawal) {
    return translateMessage(language, 'bonds.timeline_display.value_meaning.withdrawal');
  }
  if (point.isMaturity) {
    return translateMessage(language, 'bonds.timeline_display.value_meaning.maturity');
  }
  if (point.accumulatedNetInterest > 0) {
    return translateMessage(
      language,
      cashFlowSemantics === 'payout'
        ? 'bonds.timeline_display.value_meaning.paid_out_cash'
        : 'bonds.timeline_display.value_meaning.retained_interest',
    );
  }
  return translateMessage(language, 'bonds.timeline_display.value_meaning.default');
}

export function getReferenceDisplayLabel(point: YearlyTimelinePoint, language: AppLanguage) {
  if (point.rateReferenceValue === undefined && point.rateMarginApplied === undefined) {
    return undefined;
  }
  const referencePart =
    point.rateReferenceValue !== undefined
      ? translateMessage(language, 'bonds.timeline_display.reference.base', {
          value: point.rateReferenceValue.toFixed(2),
        })
      : undefined;
  const marginPart =
    point.rateMarginApplied !== undefined
      ? translateMessage(language, 'bonds.timeline_display.reference.margin', {
          value: point.rateMarginApplied.toFixed(2),
        })
      : undefined;
  return [referencePart, marginPart].filter(Boolean).join(' | ');
}
