import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RecalculateButton } from './RecalculateButton';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key }),
}));

describe('RecalculateButton', () => {
  it('submits its associated form without duplicating an onClick calculation', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onClick = vi.fn();

    render(
      <>
        <form id="calculator" onSubmit={onSubmit} />
        <RecalculateButton formId="calculator" isDirty loading={false} onClick={onClick} />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'common.recalculate' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not expose an actionable control while a calculation is in progress', () => {
    render(<RecalculateButton isDirty loading onClick={vi.fn()} />);

    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    expect(screen.getByText('common.calculation_in_progress')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
