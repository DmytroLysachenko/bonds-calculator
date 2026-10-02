import { CalculationDataFreshness } from '@/features/bond-core/types/scenarios';
import type { DataReferenceMetaLike } from '@/shared/lib/data-reference';

export function getCalculationReferenceMeta(
  freshness?: CalculationDataFreshness,
): DataReferenceMetaLike | undefined {
  if (!freshness) return undefined;

  return {
    source: freshness.usedFallback ? 'fallback' : 'database',
    usedFallback: freshness.usedFallback,
    asOf: freshness.coverageAsOf ?? freshness.asOf,
    lastCheck: freshness.lastSyncedAt ?? freshness.lastCheck,
    dataSource:
      freshness.bondOfferSource === 'gov.pl' || freshness.bondOfferSource === 'obligacjeskarbowe.pl'
        ? 'Official bond offer page'
        : freshness.bondOfferSource === 'curated-fallback'
          ? 'Static fallback dataset'
          : undefined,
    syncStatus:
      freshness.status === 'fresh'
        ? 'success'
        : freshness.status === 'stale'
          ? 'stale'
          : freshness.status === 'fallback' || freshness.usedFallback
            ? 'partial'
            : 'failed',
  };
}

export function formatFreshnessDate(value?: string) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

export function getFreshnessCoverageLabel(freshness?: CalculationDataFreshness) {
  if (!freshness) {
    return null;
  }

  return freshness.coverageAsOf ?? freshness.asOf ?? null;
}

export function getFreshnessLastSyncLabel(freshness?: CalculationDataFreshness) {
  if (!freshness) {
    return null;
  }

  return formatFreshnessDate(freshness.lastSyncedAt ?? freshness.lastCheck);
}

export function getFreshnessPrimaryDateLabel(
  freshness: CalculationDataFreshness | undefined,
  fallback: string,
) {
  return getFreshnessCoverageLabel(freshness) ?? fallback;
}

export function getFreshnessDisplayState(
  freshness: CalculationDataFreshness | undefined,
  fallback: string,
) {
  return {
    coverageLabel: getFreshnessPrimaryDateLabel(freshness, fallback),
    lastSyncLabel: getFreshnessLastSyncLabel(freshness),
  };
}

export function getCalculationFreshnessMetaState(freshness: CalculationDataFreshness) {
  const isFresh = freshness.status === 'fresh';

  return {
    status: freshness.status,
    isFresh,
    coverageLabel: getFreshnessCoverageLabel(freshness),
    lastSyncLabel: getFreshnessLastSyncLabel(freshness),
    usedFallback: freshness.usedFallback,
    toneClass: isFresh
      ? 'border-[var(--finance-success)] text-foreground'
      : 'border-[var(--finance-warning)] text-foreground',
    dotClass: isFresh ? 'bg-[var(--finance-success)]' : 'bg-[var(--finance-warning)]',
  };
}

export function getBondOfferFreshnessState(freshness?: CalculationDataFreshness) {
  const source = freshness?.bondOfferSource;
  const status = freshness?.bondOfferStatus;

  return {
    source,
    attemptLabel: formatFreshnessDate(freshness?.bondOfferAttemptAt),
    status,
    isDegraded: !source || status !== 'success' || source !== 'gov.pl',
  };
}

export function getBondOfferSourceTranslationKey(source?: string) {
  const translationKeys: Record<string, string> = {
    'gov.pl': 'gov_pl',
    'obligacjeskarbowe.pl': 'obligacjeskarbowe_pl',
    'curated-fallback': 'curated-fallback',
  };

  return translationKeys[source ?? ''] ?? 'unavailable';
}
