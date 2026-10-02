import { z } from 'zod';

import { createDefaultSyncEngine } from '@/lib/sync/create-sync-engine';
import { seedMarketHistory } from '@/lib/sync/seed-market-history';
import { seedSeriesMetadata } from '@/lib/sync/seed-series-runner';
import { syncMarketHistory } from '@/lib/sync/sync-market-history';

export type SyncMode =
  'full-sync' | 'market-history-seed' | 'market-history-sync' | 'metadata-seed';

const ADMIN_SYNC_MODES = [
  'full-sync',
  'metadata-seed',
  'market-history-seed',
  'market-history-sync',
] as const satisfies readonly SyncMode[];

export const AdminSyncPayloadSchema = z
  .object({
    mode: z.enum(ADMIN_SYNC_MODES).optional(),
  })
  .default({});

export interface AdminSyncPayload {
  mode?: SyncMode;
}

export interface AdminSyncCommand {
  mode: SyncMode;
}

export interface AdminSyncSuccessEnvelope<TResult> {
  message: string;
  timestamp: string;
  mode: SyncMode;
  results: TResult;
}

export function createAdminSyncCommand(
  payload: AdminSyncPayload | null | undefined,
): AdminSyncCommand {
  return {
    mode: payload?.mode ?? 'full-sync',
  };
}

export function createAdminSyncSuccessEnvelope<TResult>(
  command: AdminSyncCommand,
  results: TResult,
  timestamp = new Date().toISOString(),
): AdminSyncSuccessEnvelope<TResult> {
  return {
    message: 'Sync completed successfully',
    timestamp,
    mode: command.mode,
    results,
  };
}

export function getAdminSyncEndpointInfo() {
  return {
    status: 'Sync endpoint ready',
    instructions: 'POST to this endpoint to trigger a full financial data sync.',
    modes: [...ADMIN_SYNC_MODES],
  };
}

export async function runAdminSync(mode: SyncMode) {
  if (mode === 'metadata-seed') {
    await seedSeriesMetadata();
    return { mode, status: 'success' };
  }

  if (mode === 'market-history-seed') {
    return seedMarketHistory();
  }

  if (mode === 'market-history-sync') {
    return syncMarketHistory();
  }

  return createDefaultSyncEngine('AdminSync').runFullSync();
}
