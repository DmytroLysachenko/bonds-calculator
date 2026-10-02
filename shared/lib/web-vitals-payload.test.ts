import { describe, expect, it } from 'vitest';

import { toWebVitalPayload } from './web-vitals-payload';

describe('toWebVitalPayload', () => {
  it('keeps only the endpoint contract fields from a web-vitals metric', () => {
    const payload = toWebVitalPayload(
      {
        name: 'LCP',
        value: 1240,
        rating: 'good',
        delta: 1240,
        id: 'v4-123',
        entries: [{ startTime: 123 }],
      },
      '/education',
      'navigate',
    );

    expect(payload).toEqual({
      name: 'LCP',
      value: 1240,
      rating: 'good',
      path: '/education',
      navigationType: 'navigate',
    });
  });
});
