import { describe, expect, it } from 'vitest';

import { THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY } from './theme-preferences';

describe('theme bootstrap', () => {
  it('applies only supported stored preferences before hydration', () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("stored === 'light' || stored === 'dark'");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("classList.toggle('dark'");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('style.colorScheme = resolved');
  });
});
