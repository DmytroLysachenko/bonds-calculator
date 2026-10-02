import type { CalculationDiagnostic } from '@/features/bond-core/types/scenarios';

type Translator = (key: string, params?: Record<string, string | number>) => string;

/** One presentation adapter for typed calculation evidence in UI and exports. */
export function localizeCalculationDiagnostic(diagnostic: CalculationDiagnostic, t: Translator) {
  const key = `bonds.engine_messages.${diagnostic.code}`;
  const value = t(key, diagnostic.params);
  return value === key
    ? t('bonds.engine_messages.unknown_diagnostic', { code: diagnostic.code })
    : value;
}

/** Compatibility only: restored pre-diagnostic results stored English prose. */
export function localizeLegacyCalculationMessage(value: string, t: Translator) {
  const numericValue = value.match(/-?\d+(?:\.\d+)?/)?.[0] ?? '';
  if (value.startsWith('Expected annual inflation:'))
    return t('bonds.engine_messages.expected_inflation', { value: numericValue });
  if (value.startsWith('Expected NBP reference rate:'))
    return t('bonds.engine_messages.expected_nbp_rate', { value: numericValue });
  const exact: Record<string, string> = {
    'Using custom user-supplied inflation overrides.': 'custom_inflation',
    'Using custom user-supplied NBP rate overrides.': 'custom_nbp',
    'Inflation history is missing; projected assumptions may be used.': 'missing_inflation_history',
    'NBP rate history is missing; projected assumptions may be used.': 'missing_nbp_history',
    'Historical data was unavailable; projected assumptions may be used.': 'missing_history',
    'Rollover is disabled; the simulation stops at the first bond cycle or selected withdrawal date.':
      'rollover_disabled',
    'Early redemption fee logic was applied before the native maturity date.':
      'early_redemption_applied',
  };
  if (exact[value]) return t(`bonds.engine_messages.${exact[value]}`);
  const cycles = value.match(
    /^Simulation covered (\d+) bond cycles? across the selected horizon\.$/,
  );
  if (cycles) return t('bonds.engine_messages.rollover_cycles', { count: Number(cycles[1]) });
  return value;
}
