import { cron } from 'inngest';

import { calculationService } from '@/lib/server/calculation/composition';

import { invalidateCached } from './data/market-data-cache';
import { runAdminSync, type SyncMode } from './server/admin/sync';
import { createServerLogger } from './server/logging';
import { createVitalRetentionCleanup } from './server/observability/vital-aggregates';
import { deleteExpiredSharedSingleScenarios } from './server/shared-scenarios/repository';
import { financialDataSyncRequestedEvent, inngest } from './inngest';

const logger = createServerLogger('InngestSync');

export const syncEconomicData = inngest.createFunction(
  {
    id: 'sync-economic-data',
    retries: 3,
    triggers: [cron('0 2,14 * * *'), { event: financialDataSyncRequestedEvent }],
  },
  async ({ step, event }) => {
    const mode: SyncMode =
      event.name === financialDataSyncRequestedEvent ? event.data.mode : 'full-sync';

    const results = await step.run(`sync-${mode}`, async () => {
      try {
        return await runAdminSync(mode);
      } catch (error) {
        logger.error(`Sync error for ${mode}`, error);
        throw error;
      }
    });

    await step.run('invalidate-derived-calculations', async () => {
      invalidateCached();
      calculationService.invalidateAuthoritativeData();
    });

    return { status: 'completed', mode, results };
  },
);

/** Retention is durable and independent from public read traffic. */
export const cleanupExpiredSharedScenarios = inngest.createFunction(
  {
    id: 'cleanup-expired-shared-scenarios',
    retries: 2,
    triggers: [cron('15 3 * * *')],
  },
  async ({ step }) => {
    const result = await step.run('delete-expired-shares', async () => {
      const deleted = await deleteExpiredSharedSingleScenarios();
      return { deletedCount: deleted.rowCount ?? 0 };
    });
    return { status: 'completed', ...result };
  },
);

/** Aggregate-only telemetry expires independently from request traffic. */
export const cleanupExpiredVitalAggregates = inngest.createFunction(
  {
    id: 'cleanup-expired-web-vital-aggregates',
    retries: 2,
    triggers: [cron('30 3 * * *')],
  },
  async ({ step }) => {
    const result = await step.run(
      'delete-expired-web-vital-aggregates',
      createVitalRetentionCleanup(),
    );
    return { status: 'completed', ...result };
  },
);
