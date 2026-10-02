import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPostgresRateLimitStore } from '@/lib/server/http/postgres-rate-limit-store';
import { type RateLimitPolicy, SharedStoreRateLimiter } from '@/lib/server/http/rate-limiter';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const policy: RateLimitPolicy = { key: 'integration', limit: 3, windowMs: 1_000 };

integration('PostgreSQL rate-limit adapter', () => {
  let sql: Sql;

  const createStore = () => {
    const database = drizzle(sql);
    return createPostgresRateLimitStore(async (query) => {
      const rows = await database.execute(query);
      return Array.from(rows) as Array<{ count: number; reset_epoch_ms: number | string }>;
    });
  };

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 4 });
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  });

  afterAll(async () => {
    await sql.end({ timeout: 2 });
  });

  it('serializes concurrent increments through the selected PostgreSQL adapter', async () => {
    const bucket = `rate-limit-${randomUUID()}`;
    const limiter = new SharedStoreRateLimiter(createStore());
    const decisions = await Promise.all(
      Array.from({ length: 6 }, () => limiter.consume(bucket, policy, 1_000)),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
    expect(decisions.map((decision) => decision.remaining).sort()).toEqual([0, 0, 0, 0, 1, 2]);
    const rows = await sql<{ count: number }[]>`
      select count from rate_limit_windows where bucket_key = ${`${policy.key}:${bucket}`}
    `;
    expect(rows).toEqual([{ count: 6 }]);
  });

  it('resets an expired durable counter before incrementing it', async () => {
    const bucket = `rate-limit-reset-${randomUUID()}`;
    const limiter = new SharedStoreRateLimiter(createStore());
    await limiter.consume(bucket, policy, 1_000);
    const afterWindow = await limiter.consume(bucket, policy, 2_000);

    expect(afterWindow).toMatchObject({ allowed: true, remaining: 2, resetAt: 3_000 });
    const rows = await sql<{ count: number }[]>`
      select count from rate_limit_windows where bucket_key = ${`${policy.key}:${bucket}`}
    `;
    expect(rows).toEqual([{ count: 1 }]);
  });
});
