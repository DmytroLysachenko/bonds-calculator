import { describe, expect, it } from 'vitest';

import { homeDecisionRoutes } from './decision-slip';

describe('home decision slip', () => {
  it('routes every starting point to an existing trusted or reference surface', () => {
    expect(homeDecisionRoutes).toEqual([
      { id: 'learn', href: '/education' },
      { id: 'check-context', href: '/economic-data' },
    ]);
  });
});
