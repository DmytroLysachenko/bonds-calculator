import { describe, expect, it } from 'vitest';

import { isNavigationRoute } from '@/lib/route-policy';

import {
  getFeaturesForNavigation,
  getFeaturesForPlacement,
  getTrustedReleaseFeatures,
} from './feature-catalog';

describe('feature catalog', () => {
  it('orders the trusted core navigation around calculation, context, and learning', () => {
    expect(getTrustedReleaseFeatures().map(({ route }) => route)).toEqual([
      '/single-calculator',
      '/economic-data',
      '/education',
    ]);
  });

  it('keeps conditional calculators together in the private-preview placement', () => {
    expect(getFeaturesForPlacement('preview').map(({ route }) => route)).toEqual([
      '/compare',
      '/regular-investment',
      '/ladder',
      '/notebook',
    ]);
    expect(getFeaturesForNavigation('conditional')).toHaveLength(4);
  });

  it('only exposes routes admitted by the shared route policy', () => {
    for (const section of ['core', 'conditional'] as const) {
      for (const feature of getFeaturesForNavigation(section)) {
        expect(isNavigationRoute(feature.route)).toBe(true);
      }
    }
    expect(isNavigationRoute('/retirement')).toBe(false);
  });
});
