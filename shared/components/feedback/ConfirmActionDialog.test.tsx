import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmActionDialog } from './ConfirmActionDialog';

describe('ConfirmActionDialog', () => {
  it('contains keyboard focus, closes on Escape, and restores the trigger', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open confirmation</button>
          <ConfirmActionDialog
            open={open}
            title="Delete?"
            description="This cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={onConfirm}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Delete?' })).toBeTruthy();
    await user.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
