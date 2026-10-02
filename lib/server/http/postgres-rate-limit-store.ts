import { type SQL, sql } from 'drizzle-orm';

import { db } from '@/db';

import type { SharedRateLimitStore } from './rate-limiter';

/** Minimal persistence seam; connection choice remains internal to HTTP policy. */
type RateLimitQueryExecutor = (
  query: SQL,
) => Promise<Array<{ count: number; reset_epoch_ms: number | string }>>;

/** PostgreSQL upsert adapter: one statement owns increment and window reset. */
export function createPostgresRateLimitStore(
  executor: RateLimitQueryExecutor,
): SharedRateLimitStore {
  return {
    async consume({ bucketKey, now, resetAt }) {
      const nowTimestamp = now.toISOString();
      const resetTimestamp = resetAt.toISOString();
      const rows = await executor(sql`
      insert into rate_limit_windows (bucket_key, count, reset_at, updated_at)
      values (${bucketKey}, 1, ${resetTimestamp}, ${nowTimestamp})
      on conflict (bucket_key) do update set
        count = case when rate_limit_windows.reset_at <= ${nowTimestamp} then 1 else rate_limit_windows.count + 1 end,
        reset_at = case when rate_limit_windows.reset_at <= ${nowTimestamp} then ${resetTimestamp} else rate_limit_windows.reset_at end,
        updated_at = ${nowTimestamp}
      returning count, extract(epoch from reset_at at time zone 'UTC') * 1000 as reset_epoch_ms
    `);
      const row = rows[0];
      if (!row) throw new Error('RATE_LIMIT_COUNTER_MISSING');
      return { count: Number(row.count), resetAt: new Date(Number(row.reset_epoch_ms)) };
    },
  };
}

export const postgresRateLimitStore = createPostgresRateLimitStore(async (query) => {
  const result = await db.execute<{ count: number; reset_epoch_ms: number | string }>(query);
  // Neon HTTP returns a result envelope; the isolated integration PostgreSQL
  // adapter returns its rows directly.
  return Array.isArray(result) ? result : result.rows;
});
