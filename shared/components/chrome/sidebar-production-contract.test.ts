import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getFeaturesForNavigation } from '@/shared/lib/feature-catalog';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function expectContains(source: string, fragment: string) {
  expect(source).toContain(fragment);
}

function expectNotContains(source: string, fragment: string) {
  expect(source).not.toContain(fragment);
}

describe('sidebar production navigation contract', () => {
  it('orders core navigation according to the authoritative release catalog', () => {
    expect(getFeaturesForNavigation('core').map(({ route }) => route)).toEqual([
      '/single-calculator',
      '/economic-data',
      '/education',
    ]);
  });
  it('keeps preview workflows in the conditional group without duplicate links', () => {
    const core = getFeaturesForNavigation('core');
    const conditional = getFeaturesForNavigation('conditional');
    expect(conditional.map(({ route }) => route)).toEqual([
      '/compare',
      '/regular-investment',
      '/ladder',
      '/notebook',
    ]);
    const routes = [...core, ...conditional].map(({ route }) => route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('keeps settings controls intentionally lightweight', () => {
    const source = read('shared/components/chrome/SidebarSettingsUtility.tsx');

    expectContains(source, '<SidebarUtilityStack>');
    expectContains(source, "title={t('common.language')}");
    expectContains(source, 'action={<LanguageSwitcher />}');
    expectContains(source, "title={t('common.theme')}");
  });

  it('does not duplicate the language selector with helper copy', () => {
    const source = read('shared/components/chrome/SidebarSettingsUtility.tsx');

    expectContains(source, 'action={<LanguageSwitcher />}');
    expectNotContains(source, 'description="PL / EN"');
    expectNotContains(source, 'PL / EN');
  });

  it('keeps settings controls within a quiet utility group', () => {
    const source = read('shared/components/chrome/SidebarSettingsUtility.tsx');
    const rowOccurrences = source.match(/<SidebarUtilityRow/g) ?? [];
    const panelOccurrences = source.match(/<SidebarUtilityPanel flush>/g) ?? [];

    expect(rowOccurrences.length).toBeGreaterThanOrEqual(1);
    expect(panelOccurrences).toHaveLength(1);
    expectContains(source, '<SidebarUtilityStack>');
  });
});
