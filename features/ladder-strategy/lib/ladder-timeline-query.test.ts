import { describe, expect, it } from 'vitest';

import { getLadderTimelineUrl, readLadderTimelineQueryState } from './ladder-timeline-query';

describe('ladder timeline query state', () => {
  it('uses safe defaults for missing or malformed state', () => {
    expect(readLadderTimelineQueryState(new URLSearchParams('ladderRows=99'))).toEqual({
      chartMode: 'yearly',
      tableFilter: 'all',
      rowLimit: 12,
    });
  });

  it('reads only supported chart, filter, and density values', () => {
    const params = new URLSearchParams('ladderChart=monthly&ladderFilter=clustered&ladderRows=50');

    expect(readLadderTimelineQueryState(params)).toEqual({
      chartMode: 'monthly',
      tableFilter: 'clustered',
      rowLimit: 50,
    });
  });

  it('preserves unrelated query parameters while sharing timeline state', () => {
    const url = new URL('https://example.test/ladder?locale=pl#timeline');

    expect(
      getLadderTimelineUrl(url, {
        chartMode: 'yearly',
        tableFilter: 'peak',
        rowLimit: 'all',
      }),
    ).toBe('/ladder?locale=pl&ladderChart=yearly&ladderFilter=peak&ladderRows=all#timeline');
  });
});
