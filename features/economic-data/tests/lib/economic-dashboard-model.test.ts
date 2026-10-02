import { describe, expect, it } from 'vitest';

import { buildReferenceProvenanceItems } from '@/shared/lib/data-reference';

import {
  buildEconomicHealthItems,
  ECONOMIC_RANGE_OPTIONS,
  type EconomicStatusLabels,
  getEconomicStatusLabel,
} from '../../lib/economic-dashboard-model';

const labels: EconomicStatusLabels = {
  source: 'Source',
  coverage: 'Coverage',
  asOf: 'As of',
  usage: 'Usage',
  synced: 'Synced',
  stale: 'Needs refresh',
  partial: 'Partial',
  fallback: 'Fallback',
};

describe('economic dashboard model', () => {
  it('reuses the shared reference provenance view model', () => {
    const meta = {
      data: [],
      source: 'database' as const,
      usedFallback: false,
      syncStatus: 'success' as const,
    };
    expect(buildEconomicHealthItems({ meta, isLoading: false, language: 'en', labels })).toEqual(
      buildReferenceProvenanceItems(meta, 'en', labels),
    );
  });
  it('keeps supported chart range options in display order', () => {
    expect(ECONOMIC_RANGE_OPTIONS.map((option) => option.value)).toEqual([
      '1Y',
      '5Y',
      '10Y',
      '30Y',
      'ALL',
    ]);
  });

  it('maps sync status to user-facing status labels', () => {
    expect(
      getEconomicStatusLabel(
        { data: [], source: 'database', usedFallback: false, syncStatus: 'success' },
        labels,
      ),
    ).toBe('Synced');
    expect(
      getEconomicStatusLabel(
        { data: [], source: 'database', usedFallback: false, syncStatus: 'stale' },
        labels,
      ),
    ).toBe('Needs refresh');
    expect(
      getEconomicStatusLabel(
        { data: [], source: 'database', usedFallback: false, syncStatus: 'partial' },
        labels,
      ),
    ).toBe('Partial');
    expect(getEconomicStatusLabel(undefined, labels)).toBe('Fallback');
  });

  it('uses loading placeholders before reference metadata is ready', () => {
    expect(
      buildEconomicHealthItems({
        isLoading: true,
        language: 'en',
        labels,
      }).map((item) => item.value),
    ).toEqual(['...', '...', '...', '...']);
  });
});
