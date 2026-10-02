import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MultiAssetHistoryStatePanel } from '@/features/comparison-engine/components/MultiAssetComparisonPanels';

describe('multi-asset history state', () => {
  it('announces unsupported replay and identifies data, currency and value bases', () => {
    const t = (key: string, values?: Record<string, string | number>) =>
      values ? `${key}: ${Object.values(values).join(', ')}` : key;
    render(
      <MultiAssetHistoryStatePanel
        usedFallbackHistory={false}
        historyCoverageLabel="2024-02–2024-04"
        historySourceLabel="database"
        historyAsOfLabel="2024-04"
        availabilitySummary=""
        coverageGaps={['2024-03']}
        priceIndexIsApproximate={false}
        replayIssue="non_contiguous"
        currencyBasis="PLN"
        observationBasis="observed"
        showRealValue
        t={t}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('replay_issue_non_contiguous');
    expect(screen.getByText(/basis: PLN/).textContent).toContain('observed');
    expect(screen.getByText(/basis: PLN/).textContent).toContain('real');
    expect(screen.getByText(/coverage_gaps/).textContent).toContain('2024-03');
  });
});
