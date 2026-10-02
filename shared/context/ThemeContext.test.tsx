import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY } from '@/shared/lib/theme-preferences';

import { ThemeProvider, useTheme } from './ThemeContext';

let dark = false;
const listeners = new Set<() => void>();
function Consumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <output>
        {theme}:{resolvedTheme}
      </output>
      {(['light', 'dark', 'system'] as const).map((value) => (
        <button key={value} onClick={() => setTheme(value)}>
          {value}
        </button>
      ))}
    </>
  );
}
beforeEach(() => {
  localStorage.clear();
  dark = false;
  listeners.clear();
  vi.stubGlobal('matchMedia', () => ({
    matches: dark,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('theme preference lifecycle', () => {
  it('follows the current preference in both transition directions', () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('light'));
    act(() => {
      dark = true;
      listeners.forEach((listener) => listener());
    });
    expect(screen.getByText('light:light')).toBeTruthy();
    fireEvent.click(screen.getByText('system'));
    expect(screen.getByText('system:dark')).toBeTruthy();
    act(() => {
      dark = false;
      listeners.forEach((listener) => listener());
    });
    expect(screen.getByText('system:light')).toBeTruthy();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });
  it('applies preferences when storage reads and writes throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('dark'));
    expect(screen.getByText('dark:dark')).toBeTruthy();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
