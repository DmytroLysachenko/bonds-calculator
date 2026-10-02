import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EconomicChartTooltip } from './EconomicChartTooltip';

describe('EconomicChartTooltip', () => {
  it('reports the underlying CPI rate when a readable-scale plot point is clipped', () => {
    render(
      <EconomicChartTooltip
        active
        label="2022-03"
        metricLabel="CPI"
        payload={[{ value: 6, color: '#123456', payload: { rate: 14.4 } }]}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('14.4%');
    expect(screen.getByRole('status').textContent).not.toContain('6%');
  });
});
