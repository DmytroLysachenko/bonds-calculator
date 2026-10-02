import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { dataPoints, dataSeries } from '@/db/schema';
import { recordSyncRun } from '@/lib/server/sync/run-history';

import { GusCpiApiClient } from '../api-clients/gus-cpi';
import { NbpApiClient } from '../api-clients/nbp';

import { createSyncLogger } from './sync-logger';

const logger = createSyncLogger('MacroDataSync');

/**
 * Helper to retry a function with exponential backoff.
 */
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

/**
 * Syncs trusted macroeconomic data for retained surfaces.
 * NBP reference-rate history is synced from official NBP data.
 * CPI is synced from the official monthly GUS archive CSV.
 */
export async function syncMacroData() {
  const startedAt = new Date();
  const nbpClient = new NbpApiClient();
  const gusCpiClient = new GusCpiApiClient();

  try {
    // These providers have independent freshness contracts. Do not let a
    // temporary GUS outage prevent a usable NBP reference-rate refresh (and
    // vice versa).
    const [cpiFetch, nbpFetch, monthlyCpiFetch] = await Promise.allSettled([
      retry(() => gusCpiClient.fetchHistoricalData()),
      retry(() => nbpClient.fetchReferenceRateHistory()),
      retry(() => gusCpiClient.fetchMonthlyHistoricalData()),
    ]);
    const cpiIndicators = cpiFetch.status === 'fulfilled' ? cpiFetch.value : [];
    const nbpIndicators = nbpFetch.status === 'fulfilled' ? nbpFetch.value : [];
    const latestCpiRate = cpiIndicators.at(-1);
    const latestNbpRate = nbpIndicators.at(-1);
    const monthlyCpiIndicators =
      monthlyCpiFetch.status === 'fulfilled' ? monthlyCpiFetch.value : [];
    const nbpUsesFallback = nbpIndicators.some(
      (indicator) => indicator.metadata?.source === 'fallback',
    );

    let cpiSeries = await db.query.dataSeries.findFirst({
      where: eq(dataSeries.slug, 'pl-cpi'),
    });

    if (!cpiSeries) {
      [cpiSeries] = await db
        .insert(dataSeries)
        .values({
          slug: 'pl-cpi',
          name: 'Poland Inflation (CPI)',
          category: 'macro',
          unit: '%',
          frequency: 'monthly',
          dataSource: 'GUS official CPI monthly archive CSV',
          freshnessPolicy: 'check-daily',
          lastSyncStatus: 'success',
        })
        .returning();
    }

    let monthlyCpiSeries = await db.query.dataSeries.findFirst({
      where: eq(dataSeries.slug, 'pl-cpi-mom'),
    });
    if (!monthlyCpiSeries) {
      [monthlyCpiSeries] = await db
        .insert(dataSeries)
        .values({
          slug: 'pl-cpi-mom',
          name: 'Poland CPI month-on-month change',
          description: 'Consumer Price Index change relative to the preceding month in Poland.',
          category: 'macro',
          unit: '%',
          frequency: 'monthly',
          dataSource: 'GUS official CPI monthly archive CSV, previous month = 100 presentation',
          freshnessPolicy: 'check-daily',
          lastSyncStatus: 'unknown',
        })
        .returning();
    }

    let nbpSeries = await db.query.dataSeries.findFirst({
      where: eq(dataSeries.slug, 'nbp-ref-rate'),
    });

    if (!nbpSeries) {
      [nbpSeries] = await db
        .insert(dataSeries)
        .values({
          slug: 'nbp-ref-rate',
          name: 'NBP Reference Rate',
          category: 'macro',
          unit: '%',
          frequency: 'on-event',
          dataSource: 'Curated NBP reference-rate history from official policy publications',
          freshnessPolicy: 'check-daily',
          lastSyncStatus: 'success',
        })
        .returning();
    }

    if (nbpIndicators.length > 0 && nbpSeries) {
      await db
        .insert(dataPoints)
        .values(
          nbpIndicators.map((indicator) => ({
            seriesId: nbpSeries.id,
            date: indicator.date,
            value: indicator.value.toString(),
            qualityFlag: nbpUsesFallback ? 'fallback' : 'verified',
            sourceMetadata:
              typeof indicator.metadata?.sourceLabel === 'string'
                ? indicator.metadata.sourceLabel
                : 'NBP official API',
          })),
        )
        .onConflictDoUpdate({
          target: [dataPoints.seriesId, dataPoints.date],
          set: {
            value: sql`EXCLUDED.value`,
            qualityFlag: sql`EXCLUDED.quality_flag`,
            sourceMetadata: sql`EXCLUDED.source_metadata`,
          },
        });

      await db
        .update(dataSeries)
        .set({
          dataSource: nbpUsesFallback
            ? 'Curated NBP reference-rate history from official policy publications'
            : 'NBP official API',
          lastDataPointDate: latestNbpRate?.date,
          lastSyncStatus: nbpUsesFallback ? 'partial' : 'success',
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, nbpSeries.id));

      await recordSyncRun({
        scope: 'macro-sync',
        provider: nbpUsesFallback ? 'NBP fallback reference history' : 'NBP official API',
        seriesSlug: 'nbp-ref-rate',
        mode: 'macro-sync',
        status: nbpUsesFallback ? 'partial' : 'success',
        inserted: nbpIndicators.length,
        updated: nbpIndicators.length,
        latestDataPointDate: latestNbpRate?.date,
        message: nbpUsesFallback
          ? 'NBP official API unavailable; curated fallback reference-rate history was used.'
          : 'NBP reference-rate history synchronized.',
        startedAt,
        finishedAt: new Date(),
      });
    } else if (nbpSeries && nbpFetch.status === 'rejected') {
      await db
        .update(dataSeries)
        .set({
          lastSyncStatus: 'failed',
          lastSyncError: String(nbpFetch.reason),
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, nbpSeries.id));

      await recordSyncRun({
        scope: 'macro-sync',
        provider: 'NBP official API',
        seriesSlug: 'nbp-ref-rate',
        mode: 'macro-sync',
        status: 'failed',
        error: String(nbpFetch.reason),
        startedAt,
        finishedAt: new Date(),
      });
    }

    if (cpiIndicators.length > 0 && cpiSeries) {
      await db
        .insert(dataPoints)
        .values(
          cpiIndicators.map((indicator) => ({
            seriesId: cpiSeries.id,
            date: indicator.date,
            value: indicator.value.toString(),
            qualityFlag: 'verified',
            sourceMetadata: GusCpiApiClient.archivePageUrl,
          })),
        )
        .onConflictDoUpdate({
          target: [dataPoints.seriesId, dataPoints.date],
          set: {
            value: sql`EXCLUDED.value`,
            qualityFlag: 'verified',
            sourceMetadata: GusCpiApiClient.archivePageUrl,
          },
        });

      await db
        .update(dataSeries)
        .set({
          dataSource: 'GUS official CPI monthly archive CSV',
          lastDataPointDate: latestCpiRate?.date,
          lastSyncStatus: 'success',
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, cpiSeries.id));

      await recordSyncRun({
        scope: 'macro-sync',
        provider: 'GUS CPI archive',
        seriesSlug: 'pl-cpi',
        mode: 'macro-sync',
        status: 'success',
        inserted: cpiIndicators.length,
        updated: cpiIndicators.length,
        latestDataPointDate: latestCpiRate?.date,
        message: 'GUS CPI monthly archive synchronized.',
        startedAt,
        finishedAt: new Date(),
      });
    } else if (cpiSeries && cpiFetch.status === 'rejected') {
      await db
        .update(dataSeries)
        .set({
          lastSyncStatus: 'failed',
          lastSyncError: String(cpiFetch.reason),
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, cpiSeries.id));

      await recordSyncRun({
        scope: 'macro-sync',
        provider: 'GUS CPI archive',
        seriesSlug: 'pl-cpi',
        mode: 'macro-sync',
        status: 'failed',
        error: String(cpiFetch.reason),
        startedAt,
        finishedAt: new Date(),
      });
    }

    if (monthlyCpiSeries && monthlyCpiIndicators.length > 0) {
      await db
        .insert(dataPoints)
        .values(
          monthlyCpiIndicators.map((indicator) => ({
            seriesId: monthlyCpiSeries.id,
            date: indicator.date,
            value: indicator.value.toString(),
            qualityFlag: 'verified',
            sourceMetadata: GusCpiApiClient.archivePageUrl,
          })),
        )
        .onConflictDoUpdate({
          target: [dataPoints.seriesId, dataPoints.date],
          set: {
            value: sql`EXCLUDED.value`,
            qualityFlag: 'verified',
            sourceMetadata: GusCpiApiClient.archivePageUrl,
          },
        });
      await db
        .update(dataSeries)
        .set({
          lastDataPointDate: monthlyCpiIndicators.at(-1)?.date,
          lastSyncStatus: 'success',
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, monthlyCpiSeries.id));
      await recordSyncRun({
        scope: 'macro-sync',
        provider: 'GUS CPI archive (previous month = 100)',
        seriesSlug: 'pl-cpi-mom',
        mode: 'macro-sync',
        status: 'success',
        inserted: monthlyCpiIndicators.length,
        updated: monthlyCpiIndicators.length,
        latestDataPointDate: monthlyCpiIndicators.at(-1)?.date,
        message: 'GUS month-on-month CPI archive synchronized.',
        startedAt,
        finishedAt: new Date(),
      });
    } else if (monthlyCpiSeries) {
      const error =
        monthlyCpiFetch.status === 'rejected'
          ? String(monthlyCpiFetch.reason)
          : 'Official archive contained no previous-month CPI observations.';
      await db
        .update(dataSeries)
        .set({ lastSyncStatus: 'failed', lastSyncError: error, updatedAt: new Date() })
        .where(eq(dataSeries.id, monthlyCpiSeries.id));
      await recordSyncRun({
        scope: 'macro-sync',
        provider: 'GUS CPI archive (previous month = 100)',
        seriesSlug: 'pl-cpi-mom',
        mode: 'macro-sync',
        status: 'failed',
        error,
        startedAt,
        finishedAt: new Date(),
      });
    }

    const results = {
      inflation: latestCpiRate?.value ?? null,
      nbp: latestNbpRate?.value ?? null,
      wibor3m: null,
      wibor6m: null,
      status:
        nbpUsesFallback || cpiFetch.status === 'rejected'
          ? ('partial' as const)
          : ('success' as const),
    };

    return results;
  } catch (error) {
    logger.error('Macro sync failed', error);
    const cpiSeries = await db.query.dataSeries.findFirst({
      where: eq(dataSeries.slug, 'pl-cpi'),
    });
    const nbpSeries = await db.query.dataSeries.findFirst({
      where: eq(dataSeries.slug, 'nbp-ref-rate'),
    });

    if (cpiSeries) {
      await db
        .update(dataSeries)
        .set({
          lastSyncStatus: 'failed',
          lastSyncError: String(error),
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, cpiSeries.id));
    }

    if (nbpSeries) {
      await db
        .update(dataSeries)
        .set({
          lastSyncStatus: 'failed',
          lastSyncError: String(error),
          updatedAt: new Date(),
        })
        .where(eq(dataSeries.id, nbpSeries.id));
    }

    await recordSyncRun({
      scope: 'macro-sync',
      provider: 'macro-data',
      mode: 'macro-sync',
      status: 'failed',
      error: String(error),
      startedAt,
      finishedAt: new Date(),
    });

    return null;
  }
}
