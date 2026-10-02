import { translateMessage } from '@/i18n/translate';

export interface DataReferenceMetaLike {
  source?: string;
  usedFallback?: boolean;
  asOf?: string;
  lastCheck?: string;
  coverageStart?: string;
  coverageEnd?: string;
  dataSource?: string;
  syncStatus?: 'success' | 'partial' | 'failed' | 'stale';
  coverageNote?: string;
  sourceUrl?: string;
}

type AppLanguage = 'pl' | 'en';
export type ReferenceMetaItem = {
  label: string;
  value: string;
};

/** Shared source, coverage, as-of, and fallback contract for trusted data UI. */
export type ReferenceProvenanceViewModel = {
  source: string;
  coverage: string;
  asOf: string;
  usesFallback: boolean;
};

export function buildReferenceProvenanceViewModel(
  meta: DataReferenceMetaLike | undefined,
  language: AppLanguage,
): ReferenceProvenanceViewModel {
  return {
    source: getReferenceSourceLabel(meta, language),
    coverage: getReferenceCoverageLabel(meta, language),
    asOf: getReferenceAsOfLabel(meta, language),
    usesFallback:
      !meta ||
      meta.usedFallback === true ||
      meta.source === 'fallback' ||
      meta.syncStatus !== 'success',
  };
}

export function buildReferenceProvenanceItems(
  meta: DataReferenceMetaLike | undefined,
  language: AppLanguage,
  labels: { source: string; coverage: string; asOf: string; usage: string },
  isLoading = false,
): ReferenceMetaItem[] {
  const view = buildReferenceProvenanceViewModel(meta, language);
  const value = (resolved: string) => (isLoading ? '...' : resolved);
  return [
    { label: labels.source, value: value(view.source) },
    { label: labels.asOf, value: value(view.asOf) },
    { label: labels.coverage, value: value(view.coverage) },
    { label: labels.usage, value: value(getReferenceScopeLabel(meta, language)) },
  ];
}
export type ReferenceStatusKind = 'synced' | 'stale' | 'partial' | 'fallback';

function ref(key: string, language: AppLanguage) {
  return translateMessage(language, `economic.reference_copy.${key}`);
}

function getKnownDataSourceLabel(value: string, language: AppLanguage) {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'static fallback dataset') {
    return ref('fallback_dataset', language);
  }

  if (normalized === 'database') {
    return ref('synced_dataset', language);
  }

  if (normalized === 'nbp official api') {
    return ref('official_nbp', language);
  }

  if (
    normalized === 'nbp official publications fallback dataset' ||
    normalized === 'curated nbp reference-rate history from official policy publications'
  ) {
    return ref('official_nbp_fallback', language);
  }

  if (
    normalized === 'gus / partial seeded coverage' ||
    normalized === 'gus/partial seeded coverage' ||
    normalized === 'gus / partial reference coverage'
  ) {
    return ref('official_gus_partial', language);
  }

  if (normalized === 'gus official cpi monthly archive csv') {
    return ref('official_gus_archive', language);
  }

  if (
    normalized === 'official bond offer page' ||
    normalized === 'official bond offer communication'
  ) {
    return ref('official_bond_site', language);
  }

  return value;
}

function getCoverageNoteLabel(value: string, language: AppLanguage) {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'cpi-partial-reference') {
    return ref('cpi_partial_reference', language);
  }

  if (normalized === 'cpi-fallback-reference') {
    return ref('cpi_fallback_reference', language);
  }

  if (normalized === 'cpi-stale-coverage') {
    return ref('cpi_stale_coverage', language);
  }

  if (normalized === 'reference-synced-context') {
    return ref('reference_synced_context', language);
  }

  if (normalized === 'nbp-fallback-reference') {
    return ref('nbp_fallback_reference', language);
  }

  if (normalized === 'nbp-partial-reference') {
    return ref('nbp_partial_reference', language);
  }

  if (normalized === 'nbp-synced-context') {
    return ref('nbp_synced_context', language);
  }

  return value;
}

export function getReferenceSourceLabel(
  meta?: DataReferenceMetaLike,
  language: AppLanguage = 'en',
) {
  if (!meta) {
    return translateMessage(language, 'common.unavailable');
  }

  if (meta.dataSource) {
    return getKnownDataSourceLabel(meta.dataSource, language);
  }

  if (meta.source === 'database') {
    return ref('synced_dataset', language);
  }

  if (meta.source === 'fallback') {
    return ref('fallback_dataset', language);
  }

  return translateMessage(language, 'common.unavailable');
}

export function getReferenceCoverageLabel(
  meta?: DataReferenceMetaLike,
  language: AppLanguage = 'en',
) {
  if (!meta?.coverageStart || !meta?.coverageEnd) {
    return ref('coverage_unavailable', language);
  }

  return `${meta.coverageStart} - ${meta.coverageEnd}`;
}

export function getReferenceAsOfLabel(meta?: DataReferenceMetaLike, language: AppLanguage = 'en') {
  return meta?.asOf ?? meta?.lastCheck ?? translateMessage(language, 'common.unavailable');
}

export function getReferenceScopeLabel(meta?: DataReferenceMetaLike, language: AppLanguage = 'en') {
  if (!meta) {
    return ref('scope_unknown', language);
  }

  if (meta.usedFallback || meta.source === 'fallback') {
    return ref('reference_only', language);
  }

  if (meta.syncStatus === 'partial' || meta.syncStatus === 'stale') {
    return ref('reference_only', language);
  }

  return ref('supports_context', language);
}

export function getReferenceStatusKind(meta?: DataReferenceMetaLike): ReferenceStatusKind {
  if (meta?.syncStatus === 'success' && !meta.usedFallback && meta.source !== 'fallback') {
    return 'synced';
  }

  if (meta?.syncStatus === 'stale') {
    return 'stale';
  }

  if (meta?.syncStatus === 'partial') {
    return 'partial';
  }

  return 'fallback';
}

export function getReferenceState(meta?: DataReferenceMetaLike, language: AppLanguage = 'en') {
  if (!meta) {
    return {
      title: ref('unavailable_title', language),
      description: ref('unavailable_description', language),
      tone: 'warning' as const,
    };
  }

  if (meta.syncStatus === 'stale') {
    return {
      title: ref('stale_title', language),
      description: meta.coverageNote
        ? getCoverageNoteLabel(meta.coverageNote, language)
        : ref('stale_description', language),
      tone: 'warning' as const,
    };
  }

  if (
    meta.usedFallback ||
    meta.source === 'fallback' ||
    meta.syncStatus === 'failed' ||
    meta.syncStatus === 'partial'
  ) {
    return {
      title: ref('fallback_title', language),
      description: meta.coverageNote
        ? getCoverageNoteLabel(meta.coverageNote, language)
        : ref('fallback_description', language),
      tone: 'warning' as const,
    };
  }

  return {
    title: ref('synced_title', language),
    description: ref('synced_description', language),
    tone: 'good' as const,
  };
}

export function getReferenceMetaItems(
  meta: DataReferenceMetaLike | undefined,
  language: AppLanguage = 'en',
): ReferenceMetaItem[] {
  return [
    {
      label: translateMessage(language, 'common.source'),
      value: getReferenceSourceLabel(meta, language),
    },
    {
      label: translateMessage(language, 'common.as_of'),
      value: getReferenceAsOfLabel(meta, language),
    },
    {
      label: translateMessage(language, 'common.coverage'),
      value: getReferenceCoverageLabel(meta, language),
    },
    {
      label: translateMessage(language, 'common.usage'),
      value: getReferenceScopeLabel(meta, language),
    },
  ];
}
