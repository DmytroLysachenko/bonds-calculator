import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CalculationMetaPanel } from './CalculationMetaPanel';

vi.mock('@/i18n/client', async () => {
  const { translateMessage } = await import('@/i18n/translate');
  return {
    useAppI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        translateMessage('pl', key, params),
      locale: 'pl',
    }),
  };
});

describe('calculation metadata evidence', () => {
  it('uses typed engine notes without repeating legacy English text', () => {
    render(
      <CalculationMetaPanel
        calculationVersion="historical-model-v7"
        calculationNotes={['Simulation covered 2 bond cycles across the selected horizon.']}
        diagnostics={[
          { code: 'rollover_cycles', severity: 'assumption', params: { count: 2 } },
          { code: 'expected_inflation', severity: 'assumption', params: { value: 3 } },
        ]}
      />,
    );
    expect(screen.getByText(/Symulacja objęła 2 cykle/)).toBeTruthy();
    expect(screen.getByText('historical-model-v7')).toBeTruthy();
    expect(screen.queryByText(/Simulation covered/)).toBeNull();
  });

  it('still renders notes from an older result without typed engine evidence', () => {
    render(
      <CalculationMetaPanel
        calculationVersion="previous-model-v1"
        calculationNotes={[
          'Rollover is disabled; the simulation stops at the first bond cycle or selected withdrawal date.',
        ]}
        diagnostics={[{ code: 'single_cycle', severity: 'assumption' }]}
      />,
    );
    expect(screen.getByText('previous-model-v1')).toBeTruthy();
    expect(screen.getByText(/Rollover jest wyłączony/)).toBeTruthy();
  });
});
