import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InflationChart } from '../components/InflationChart';
import { NBPRateChart } from '../components/NBPRateChart';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

const { chartResource } = vi.hoisted(() => ({ chartResource: vi.fn() }));

vi.mock('@/shared/hooks/useChartData', () => ({ useChartData: chartResource }));

describe('economic chart failures', () => {
  it('keeps the last successfully loaded reference visible during a refresh failure', () => {
    chartResource.mockReturnValue({
      data: {
        data: [{ date: '2026-01', rate: 3.2 }],
        source: 'database',
        usedFallback: false,
      },
      isLoading: false,
      isError: true,
    });

    render(<InflationChart />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('economic.compact_source_header')).toBeTruthy();
  });

  it.each(['inflation', 'NBP'])('announces an unavailable %s reference series', (series) => {
    chartResource.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(series === 'inflation' ? <InflationChart /> : <NBPRateChart />);

    expect(screen.getByRole('status').textContent).toContain('economic.failed_to_load');
  });
});
