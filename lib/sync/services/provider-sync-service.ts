import { format, isBefore, parseISO, startOfMonth } from 'date-fns';

import type { SyncLogger } from '../sync-logger';
import type { SyncProvider } from '../types';

import {
  createDefaultProviderSyncRepository,
  type ProviderSyncRepository,
} from './provider-sync-repository';
import type { SyncRunRecorder } from './sync-run-recorder';

export type { ProviderSyncRepository } from './provider-sync-repository';

type ProviderSyncStatus = 'success' | 'up-to-date' | 'no-new-data' | 'failed';

export interface ProviderSyncResult {
  provider: string;
  seriesSlug: string;
  status: ProviderSyncStatus;
  rangeStart?: string;
  rangeEnd?: string;
  inserted?: number;
  updated?: number;
  skipped?: number;
  latestDataPointDate?: string;
  error?: string;
}

export class ProviderSyncService {
  constructor(
    private readonly providers: SyncProvider[],
    private readonly logger: SyncLogger,
    private readonly recorder: Pick<SyncRunRecorder, 'record'>,
    private readonly repository: ProviderSyncRepository = createDefaultProviderSyncRepository(),
  ) {}

  async syncAll(startYear = 1910): Promise<ProviderSyncResult[]> {
    const results: ProviderSyncResult[] = [];

    for (const provider of this.providers) {
      try {
        this.logger.info(`Starting sync for ${provider.name}`);
        results.push(await this.syncProvider(provider, startYear));
      } catch (error) {
        this.logger.error(`Failed sync for ${provider.name}`, error);
        const errorMessage = String(error);
        try {
          const series = await this.repository.findSeriesBySlug(provider.seriesSlug);
          if (series) {
            await this.repository.markSeriesSyncFailure(series.id, errorMessage);
          }
        } catch (persistenceError) {
          this.logger.error(
            `Failed to persist failed status for ${provider.name}`,
            persistenceError,
          );
        }
        const failure: ProviderSyncResult = {
          provider: provider.name,
          seriesSlug: provider.seriesSlug,
          status: 'failed',
          error: errorMessage,
        };
        await this.recorder.record({
          scope: provider.name,
          provider: provider.name,
          seriesSlug: provider.seriesSlug,
          mode: 'provider-sync',
          status: 'failed',
          error: errorMessage,
          startedAt: new Date(),
          finishedAt: new Date(),
        });
        results.push(failure);
      }
    }

    return results;
  }

  private async syncProvider(
    provider: SyncProvider,
    startYear: number,
  ): Promise<ProviderSyncResult> {
    const series = await this.repository.findSeriesBySlug(provider.seriesSlug);

    if (!series) {
      throw new Error(
        `Base series metadata for ${provider.seriesSlug} not found. Run seed-series first.`,
      );
    }

    const lastPoint = await this.repository.findLatestPointForSeries(series.id);

    // Re-fetch the latest calendar month on every run. Market providers have no
    // observations on weekends and holidays, and an in-progress month can gain
    // further trading days after the first successful sync.
    let currentStartDate = lastPoint ? parseISO(lastPoint.date) : parseISO(`${startYear}-01-01`);

    currentStartDate = startOfMonth(currentStartDate);
    const today = new Date();
    const startDateStr = format(currentStartDate, 'yyyy-MM-dd');
    const endDateStr = format(today, 'yyyy-MM-dd');
    const startedAt = new Date();

    if (isBefore(today, currentStartDate)) {
      const result: ProviderSyncResult = {
        provider: provider.name,
        seriesSlug: provider.seriesSlug,
        status: 'up-to-date',
        rangeStart: startDateStr,
        rangeEnd: endDateStr,
        inserted: 0,
        updated: 0,
        skipped: 0,
        latestDataPointDate: lastPoint?.date,
      };
      this.logger.info(`${provider.name} (${provider.seriesSlug}) is already up to date`);
      await this.recordProviderResult(result, startedAt);
      return result;
    }

    this.logger.info(`Fetching ${provider.name}`, {
      startDate: startDateStr,
      endDate: endDateStr,
    });
    const data = await provider.fetchData(startDateStr, endDateStr);

    if (data.length === 0) {
      const result: ProviderSyncResult = {
        provider: provider.name,
        seriesSlug: provider.seriesSlug,
        status: 'no-new-data',
        rangeStart: startDateStr,
        rangeEnd: endDateStr,
        inserted: 0,
        updated: 0,
        skipped: 0,
        latestDataPointDate: lastPoint?.date,
      };
      this.logger.info(`No new data found for ${provider.name}`);
      await this.recordProviderResult(result, startedAt);
      return result;
    }

    const recordSlugs = [...new Set(data.map((record) => record.seriesSlug))];
    const seriesBySlug = await this.repository.findSeriesBySlugs(recordSlugs);
    seriesBySlug.set(provider.seriesSlug, series);

    const recordsToInsert: Array<{ seriesId: string; date: string; value: string }> = [];
    for (const record of data) {
      const matchingSeries = seriesBySlug.get(record.seriesSlug);
      if (!matchingSeries) {
        continue;
      }

      recordsToInsert.push({
        seriesId: matchingSeries.id,
        date: record.date,
        value: record.value.toString(),
      });
    }

    if (recordsToInsert.length > 0) {
      await this.repository.upsertDataPoints(recordsToInsert);

      const latestDate = recordsToInsert
        .map((record) => record.date)
        .sort()
        .at(-1);
      if (latestDate) {
        await this.repository.markSeriesSyncSuccess(series.id, {
          latestDate,
          status: 'success',
        });
      }
    }

    const result: ProviderSyncResult = {
      provider: provider.name,
      seriesSlug: provider.seriesSlug,
      status: 'success',
      rangeStart: startDateStr,
      rangeEnd: endDateStr,
      inserted: recordsToInsert.length,
      updated: recordsToInsert.length,
      skipped: Math.max(0, data.length - recordsToInsert.length),
      latestDataPointDate: recordsToInsert
        .map((record) => record.date)
        .sort()
        .at(-1),
    };
    await this.recordProviderResult(result, startedAt);
    return result;
  }

  private async recordProviderResult(result: ProviderSyncResult, startedAt: Date) {
    await this.recorder.record({
      scope: result.provider,
      provider: result.provider,
      seriesSlug: result.seriesSlug,
      mode: 'provider-sync',
      status: result.status,
      rangeStart: result.rangeStart,
      rangeEnd: result.rangeEnd,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      latestDataPointDate: result.latestDataPointDate,
      error: result.error,
      startedAt,
      finishedAt: new Date(),
    });
  }
}
