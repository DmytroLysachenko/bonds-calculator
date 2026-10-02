import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CalculationMetaPanel } from '@/shared/components/results/CalculationMetaPanel';
import { MetricStrip } from '@/shared/components/results/MetricStrip';
import { ResultSummaryHero } from '@/shared/components/results/ResultSummaryHero';
import { ScenarioFactsBlock } from '@/shared/components/results/ScenarioFactsBlock';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

describe('single calculator result semantics', () => {
  it('renders a verdict-first result hierarchy with readable metrics and scenario facts', () => {
    render(
      <>
        <ResultSummaryHero
          eyebrow="Simulation result"
          value="12,500 PLN"
          description="Net payout at the selected date"
        />
        <MetricStrip items={[{ label: 'Profit', value: '2,500 PLN' }]} />
        <ScenarioFactsBlock
          title="Scenario facts"
          description="Inputs used"
          items={[{ label: 'Bond', value: 'EDO' }]}
        />
      </>,
    );

    expect(screen.getByRole('heading', { level: 2, name: '12,500 PLN' })).toBeTruthy();
    expect(screen.getByText('Net payout at the selected date')).toBeTruthy();
    expect(screen.getByText('Profit')).toBeTruthy();
    expect(screen.getByText('2,500 PLN')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Scenario facts' })).toBeTruthy();
    expect(screen.getByText('EDO')).toBeTruthy();
  });

  it('exposes warnings, audit information, source, freshness, and fallback use', () => {
    render(
      <CalculationMetaPanel
        warnings={['Inflation history is missing; projected assumptions may be used.']}
        calculationVersion="trusted-v1"
        dataFreshness={{
          status: 'fallback',
          usedFallback: true,
          coverageAsOf: '2026-06',
          lastSyncedAt: '2026-07-01T10:00:00.000Z',
          bondOfferSource: 'curated-fallback',
          bondOfferStatus: 'partial',
        }}
      />,
    );

    expect(screen.getByText('common.warnings')).toBeTruthy();
    expect(screen.getByText('bonds.engine_messages.missing_inflation_history')).toBeTruthy();
    expect(screen.getByText('comparison.fallback_used')).toBeTruthy();
    expect(screen.getByText('2026-06')).toBeTruthy();
    expect(screen.getByText('2026-07-01')).toBeTruthy();
    expect(screen.getByText('Fallback dataset')).toBeTruthy();
    expect(screen.getByText('common.calculation_audit')).toBeTruthy();
    expect(screen.getByText('trusted-v1')).toBeTruthy();
  });
});
