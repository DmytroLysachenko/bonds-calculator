import { desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { dataPoints, dataSeries } from '@/db/schema';

export interface ProviderSyncRepository {
  findSeriesBySlug(seriesSlug: string): Promise<{ id: string } | null>;
  findSeriesBySlugs(seriesSlugs: readonly string[]): Promise<Map<string, { id: string }>>;
  findLatestPointForSeries(seriesId: string): Promise<{ date: string } | null>;
  upsertDataPoints(
    records: Array<{
      seriesId: string;
      date: string;
      value: string;
    }>,
  ): Promise<void>;
  markSeriesSyncSuccess(
    seriesId: string,
    values: {
      latestDate: string;
      status: 'success';
    },
  ): Promise<void>;
  markSeriesSyncFailure(seriesId: string, error: string): Promise<void>;
}

export function createDefaultProviderSyncRepository(): ProviderSyncRepository {
  return {
    async findSeriesBySlug(seriesSlug) {
      return (
        (await db.query.dataSeries.findFirst({
          where: eq(dataSeries.slug, seriesSlug),
        })) ?? null
      );
    },
    async findSeriesBySlugs(seriesSlugs) {
      if (seriesSlugs.length === 0) {
        return new Map();
      }

      const series = await db.query.dataSeries.findMany({
        where: inArray(dataSeries.slug, [...seriesSlugs]),
      });
      return new Map(series.map((item) => [item.slug, { id: item.id }]));
    },
    async findLatestPointForSeries(seriesId) {
      return (
        (await db.query.dataPoints.findFirst({
          where: eq(dataPoints.seriesId, seriesId),
          orderBy: [desc(dataPoints.date)],
        })) ?? null
      );
    },
    async upsertDataPoints(records) {
      await db
        .insert(dataPoints)
        .values(records)
        .onConflictDoUpdate({
          target: [dataPoints.seriesId, dataPoints.date],
          set: { value: sql`EXCLUDED.value` },
        });
    },
    async markSeriesSyncSuccess(seriesId, values) {
      await db
        .update(dataSeries)
        .set({
          lastDataPointDate: values.latestDate,
          lastSyncStatus: values.status,
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, seriesId));
    },
    async markSeriesSyncFailure(seriesId, error) {
      await db
        .update(dataSeries)
        .set({
          lastSyncStatus: 'failed',
          lastSyncError: error,
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, seriesId));
    },
  };
}
