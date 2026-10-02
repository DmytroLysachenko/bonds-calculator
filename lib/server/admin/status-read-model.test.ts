import { describe, expect, it } from 'vitest';

import {
  createAdminSeriesStatus,
  createAdminStatusSnapshot,
  createLatestBondOfferSyncSummary,
} from './status-read-model';

const series = {
  id: 'series-1',
  slug: 'pl-cpi',
  name: 'Inflation',
  frequency: 'monthly',
  lastDataPointDate: null,
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  lastSyncStatus: 'success',
  lastSyncError: null,
};

describe('admin status read model', () => {
  it.each([
    ['success', 'gov.pl', 'Official current-offer sync completed.'],
    [
      'partial',
      'obligacjeskarbowe.pl',
      'Bond-offer sync completed with fallback or secondary evidence.',
    ],
    ['failed', null, 'Bond-offer sync failed; current-offer evidence is unavailable.'],
  ])('summarizes a %s bond-offer run with a safe message', (status, provider, message) => {
    expect(
      createLatestBondOfferSyncSummary([
        {
          scope: 'bond-offers',
          provider,
          status,
          finishedAt: '2026-06-15T11:05:00.000Z',
        },
      ]),
    ).toEqual({ source: provider, status, completedAt: '2026-06-15T11:05:00.000Z', message });
  });

  it('reports null when bond-offer sync has never run', () => {
    expect(createLatestBondOfferSyncSummary([])).toBeNull();
  });

  it('uses data-point stats when series metadata has no last data point', () => {
    expect(
      createAdminSeriesStatus(series, [
        {
          seriesId: 'series-1',
          totalPoints: '42',
          latestDate: '2026-05-01',
        },
      ]),
    ).toMatchObject({
      id: 'series-1',
      pointCount: 42,
      lastDataPointDate: '2026-05-01',
      lastSyncAttemptAt: null,
      lastSyncAttemptStatus: null,
    });
  });

  it('keeps explicit series metadata date ahead of aggregate stats', () => {
    expect(
      createAdminSeriesStatus(
        {
          ...series,
          lastDataPointDate: '2026-06-01',
        },
        [
          {
            seriesId: 'series-1',
            totalPoints: 12,
            latestDate: '2026-05-01',
          },
        ],
      ),
    ).toMatchObject({
      pointCount: 12,
      lastDataPointDate: '2026-06-01',
      lastSyncAttemptAt: null,
      lastSyncAttemptStatus: null,
    });
  });

  it('defaults point count and date when no aggregate stats exist', () => {
    expect(createAdminSeriesStatus(series, [])).toMatchObject({
      pointCount: 0,
      lastDataPointDate: null,
      lastSyncAttemptAt: null,
      lastSyncAttemptStatus: null,
    });
  });

  it('keeps latest data point separate from latest sync attempt evidence', () => {
    expect(
      createAdminSeriesStatus(
        series,
        [{ seriesId: 'series-1', totalPoints: 7, latestDate: '2026-05-01' }],
        [
          {
            seriesSlug: 'pl-cpi',
            status: 'partial',
            startedAt: '2026-06-15T10:00:00.000Z',
            finishedAt: '2026-06-15T10:05:00.000Z',
          },
        ],
      ),
    ).toMatchObject({
      lastDataPointDate: '2026-05-01',
      lastSyncAttemptAt: '2026-06-15T10:05:00.000Z',
      lastSyncAttemptStatus: 'partial',
    });
  });

  it('creates a full snapshot with sync runs and environment fallback', () => {
    const snapshot = createAdminStatusSnapshot({
      series: [series],
      pointStats: [{ seriesId: 'series-1', totalPoints: '7', latestDate: '2026-05-01' }],
      recentSyncRuns: [
        {
          id: 'sync-1',
          seriesSlug: 'pl-cpi',
          status: 'success',
          startedAt: new Date('2026-06-15T11:00:00.000Z'),
        },
      ],
      systemTime: '2026-06-15T12:00:00.000Z',
    });

    expect(snapshot).toEqual({
      series: [
        {
          ...series,
          pointCount: 7,
          lastDataPointDate: '2026-05-01',
          lastSyncAttemptAt: '2026-06-15T11:00:00.000Z',
          lastSyncAttemptStatus: 'success',
        },
      ],
      systemTime: '2026-06-15T12:00:00.000Z',
      env: 'unknown',
      latestBondOfferSync: null,
      recentSyncRuns: [
        {
          id: 'sync-1',
          seriesSlug: 'pl-cpi',
          status: 'success',
          startedAt: new Date('2026-06-15T11:00:00.000Z'),
        },
      ],
    });
  });
});
