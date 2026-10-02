import { describe, expect, it } from 'vitest';

import { buildComparisonChartSummary } from '@/features/comparison-engine/lib/comparison-results-chart-model';
import { translateMessage } from '@/i18n/translate';

describe('bond comparison chart summary', () => {
  it.each(['en', 'pl'] as const)(
    'formats the populated summary without ICU errors in %s',
    (locale) => {
      const summary = buildComparisonChartSummary(
        [
          { label: 'start', date: '2025-01-01', nominalA: 100, nominalB: 100 },
          { label: 'end', date: '2026-01-01', nominalA: 110, nominalB: 120 },
        ],
        (value) => `${value} PLN`,
        (key, values) => translateMessage(locale, key, values),
      );

      expect(summary).toContain('110 PLN');
      expect(summary).toContain('120 PLN');
      expect(summary).not.toContain('comparison.bond_chart_accessible_summary');
    },
  );
});
