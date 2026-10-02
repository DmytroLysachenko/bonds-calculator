import { render, screen } from '@testing-library/react';
import { enUS } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';

import { TimingSection } from './TimingSection';

vi.mock('@/shared/components/feedback/InfoTooltip', () => ({
  InfoTooltip: () => null,
}));

describe('TimingSection', () => {
  it('associates both calendar controls with visible labels in exact-date mode', () => {
    render(
      <TimingSection
        timingMode="exact"
        purchaseDate="2026-05-01"
        withdrawalDate="2028-05-01"
        investmentHorizonYears={2}
        dateLocale={enUS}
        onUpdate={vi.fn()}
        t={(key) => key}
      />,
    );

    expect(screen.getByRole('button', { name: 'bonds.purchase_date' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'bonds.withdrawal_date' })).toBeTruthy();
  });
});
