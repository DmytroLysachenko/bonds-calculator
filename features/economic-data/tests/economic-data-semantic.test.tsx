import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RangeActions } from '../components/EconomicDashboardSections';
import { EconomicSeriesStatusCard } from '../components/EconomicSeriesStatusCard';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

describe('economic data semantics', () => {
  it('offers keyboard-operable series, range, and CPI-scale controls', async () => {
    const user = userEvent.setup();
    const setSeries = vi.fn();
    const setPeriod = vi.fn();
    const setScale = vi.fn();
    render(
      <RangeActions
        series="cpi"
        setSeries={setSeries}
        period="5Y"
        setPeriod={setPeriod}
        scale="readable"
        setScale={setScale}
        rangeLabel="Range"
        hint="Range hint"
      />,
    );

    expect(screen.getByRole('button', { name: /CPI/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '5Y' }).getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'economic.readable_scale' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(screen.getByRole('button', { name: 'NBP' }));
    await user.click(screen.getByRole('button', { name: '10Y' }));
    await user.click(screen.getByRole('button', { name: 'economic.full_scale' }));
    expect(setSeries).toHaveBeenCalledWith('nbp');
    expect(setPeriod).toHaveBeenCalledWith('10Y');
    expect(setScale).toHaveBeenCalledWith('full');
  });

  it('renders source, coverage, as-of, and fallback status as readable metadata', () => {
    render(
      <EconomicSeriesStatusCard
        title="Inflation"
        isLoading={false}
        language="en"
        meta={{
          data: [],
          source: 'fallback',
          usedFallback: true,
          syncStatus: 'partial',
          dataSource: 'Static fallback dataset',
          coverageStart: '2020-01',
          coverageEnd: '2026-06',
          asOf: '2026-06',
        }}
      />,
    );

    expect(screen.getByText('economic.reference_state.partial')).toBeTruthy();
    expect(screen.getByText('common.source')).toBeTruthy();
    expect(screen.getByText('common.coverage')).toBeTruthy();
    expect(screen.getByText('common.as_of')).toBeTruthy();
    expect(screen.getByText('Fallback dataset')).toBeTruthy();
    expect(screen.getByText('2020-01 - 2026-06')).toBeTruthy();
    expect(screen.getByText('2026-06')).toBeTruthy();
  });
});
