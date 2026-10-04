import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSavedScenario, saveScenarioRecord } from '../lib/scenario-storage';
import { buildFallbackInputs } from '../lib/single-calculator-state';

import { SavedScenarioLibrary } from './SavedScenarioLibrary';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ locale: 'pl' }),
}));

const t = (key: string) => key;

describe('SavedScenarioLibrary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps a full library compact until explicitly expanded', async () => {
    const inputs = buildFallbackInputs(new Date('2026-09-29T12:00:00Z'));
    for (let index = 0; index < 12; index += 1) {
      saveScenarioRecord(createSavedScenario(inputs, { name: `Scenario ${index + 1}` }));
    }
    const user = userEvent.setup();

    render(<SavedScenarioLibrary isDirty={false} onRestore={vi.fn()} t={t} />);

    const toggle = await screen.findByRole('button', { name: /common.show_all/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('button', { name: 'bonds.saved_library.restore' })).toHaveLength(2);
    expect(screen.queryByRole('textbox', { name: 'bonds.saved_library.search' })).toBeNull();
    expect(screen.getAllByText(/#1 ·/).some((element) => !element.closest('[hidden]'))).toBe(true);
    expect(screen.getAllByText(/#2 ·/).some((element) => !element.closest('[hidden]'))).toBe(true);

    toggle.focus();
    await user.keyboard('{Enter}');

    expect(
      screen.getByRole('button', { name: 'common.show_less' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(screen.getAllByRole('button', { name: 'bonds.saved_library.restore' })).toHaveLength(12);
    expect(screen.getByRole('textbox', { name: 'bonds.saved_library.search' })).toBeTruthy();
  });

  it('reveals the dirty-draft confirmation when restoring from the compact preview', async () => {
    const inputs = buildFallbackInputs(new Date('2026-09-29T12:00:00Z'));
    saveScenarioRecord(createSavedScenario(inputs, { name: 'My scenario' }));
    const onRestore = vi.fn();
    const user = userEvent.setup();

    render(<SavedScenarioLibrary isDirty onRestore={onRestore} t={t} />);
    await user.click(await screen.findByRole('button', { name: 'bonds.saved_library.restore' }));

    expect(screen.getByText('bonds.saved_library.restore_dirty')).toBeTruthy();
    expect(onRestore).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'bonds.saved_library.restore_confirm' }));
    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        bondType: inputs.bondType,
        initialInvestment: inputs.initialInvestment,
        purchaseDate: inputs.purchaseDate,
      }),
    );
  });

  it('makes restore visible and requires confirmation before deleting a scenario', async () => {
    const inputs = buildFallbackInputs(new Date('2026-09-29T12:00:00Z'));
    saveScenarioRecord(createSavedScenario(inputs, { name: 'Keep me' }));
    const user = userEvent.setup();

    render(<SavedScenarioLibrary isDirty={false} onRestore={vi.fn()} t={t} />);
    await user.click(await screen.findByRole('button', { name: /common.show_all/ }));
    expect(screen.getByRole('button', { name: 'bonds.saved_library.restore' })).toBeTruthy();
    expect(screen.getByText('bonds.saved_library.more_actions').closest('details')?.open).toBe(
      false,
    );

    await user.click(screen.getByText('bonds.saved_library.more_actions'));
    await user.click(screen.getByRole('button', { name: 'bonds.saved_library.delete' }));
    expect(
      screen.getByRole('group', { name: 'bonds.saved_library.delete_confirm_title' }),
    ).toBeTruthy();
    expect(screen.getByText('Keep me')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(screen.getByText('Keep me')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'bonds.saved_library.delete' }));
    await user.click(screen.getAllByRole('button', { name: 'bonds.saved_library.delete' })[1]);
    expect(screen.getByText('bonds.saved_library.empty')).toBeTruthy();
  });
});
