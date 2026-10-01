import { randomUUID } from 'node:crypto';

import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as runtimeSchema from '@/db/schema';
import { REQUIRED_MIGRATION_HASHES } from '@/lib/server/readiness/service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('reviewed PostgreSQL migrations', () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  });

  afterAll(async () => {
    await sql.end({ timeout: 2 });
  });

  it('enforces share retention and financial amount constraints in PostgreSQL', async () => {
    await expect(
      sql`
        insert into shared_single_scenarios (id, share_id, title, payload_json, expires_at)
        values (${randomUUID()}, ${randomUUID()}, ${'   '}, ${'{}'}, ${new Date()})
      `,
    ).rejects.toThrow();

    await expect(
      sql`
        insert into user_investment_lots (id, portfolio_id, bond_type, purchase_date, amount)
        values (${randomUUID()}, ${randomUUID()}, ${'EDO'}, ${'2026-01-01'}, ${'-1'})
      `,
    ).rejects.toThrow();
  });

  it('applies the complete reviewed journal and exposes required operational tables', async () => {
    const migrations = await sql<{ hash: string }[]>`
      select hash from drizzle.__drizzle_migrations order by created_at asc, id asc
    `;
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('rate_limit_windows', 'admin_audit_events', 'web_vital_aggregates')
      order by table_name
    `;
    const bondColumns = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'polish_bonds'
        and column_name in ('full_name_en', 'description_en', 'first_year_rate')
      order by column_name
    `;

    expect(tables.map((row) => row.table_name)).toEqual([
      'admin_audit_events',
      'rate_limit_windows',
      'web_vital_aggregates',
    ]);
    expect(migrations.map((migration) => migration.hash)).toEqual(REQUIRED_MIGRATION_HASHES);
    expect(bondColumns.map((column) => column.column_name)).toEqual([
      'description_en',
      'first_year_rate',
      'full_name_en',
    ]);
  });

  it('provides every runtime Drizzle table column through the reviewed journal', async () => {
    const rows = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
    `;
    const actual = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = (Object.values(runtimeSchema) as unknown[])
      .filter((value): value is PgTable => is(value, PgTable))
      .flatMap((table) => {
        const config = getTableConfig(table);
        return config.columns
          .map((column) => `${config.name}.${column.name}`)
          .filter((column) => !actual.has(column));
      });
    expect(missing).toEqual([]);
  });

  it('enforces aggregate-only vital keys and accepts a migrated aggregate', async () => {
    const bucket = '2026-07-30T10:00:00.000Z';
    await sql`
      insert into web_vital_aggregates
        (metric, path, rating, time_bucket, sample_count, value_sum, value_min, value_max)
      values ('LCP', '/compare', 'good', ${bucket}, 1, 1200, 1200, 1200)
      on conflict do nothing
    `;

    const rows = await sql<{ sample_count: number }[]>`
      select sample_count from web_vital_aggregates
      where metric = 'LCP' and path = '/compare' and time_bucket = ${bucket}
    `;
    expect(rows[0]?.sample_count).toBe(1);

    await expect(sql`
      insert into web_vital_aggregates
        (metric, path, rating, time_bucket, sample_count, value_sum, value_min, value_max)
      values ('LCP', '/?email=test@example.com', 'good', ${'2026-07-30T11:00:00.000Z'}, 1, 1, 1, 1)
    `).rejects.toThrow();
  });

  it('keeps portfolio reads owner-scoped in the migrated database', async () => {
    const ownerA = `owner-a-${randomUUID()}`;
    const ownerB = `owner-b-${randomUUID()}`;
    const portfolioA = randomUUID();
    const portfolioB = randomUUID();
    await sql`insert into "user" (id, name) values (${ownerA}, 'Owner A'), (${ownerB}, 'Owner B')`;
    await sql`
      insert into user_portfolios (id, user_id, name)
      values (${portfolioA}, ${ownerA}, 'A'), (${portfolioB}, ${ownerB}, 'B')
    `;
    await sql`
      insert into user_investment_lots (id, portfolio_id, bond_type, purchase_date, amount)
      values (${randomUUID()}, ${portfolioA}, 'COI', '2026-01-01', 100),
             (${randomUUID()}, ${portfolioB}, 'EDO', '2026-01-01', 100)
    `;
    const visibleToA = await sql<{ name: string }[]>`
      select p.name from user_portfolios p where p.user_id = ${ownerA}
    `;
    expect(visibleToA).toEqual([{ name: 'A' }]);
  });

  it('rolls back a multi-write transaction against the migrated schema', async () => {
    const title = `rollback-${randomUUID()}`;

    await expect(
      sql.begin(async (transaction) => {
        await transaction.unsafe(
          'insert into shared_single_scenarios (id, share_id, title, payload_json, expires_at) values ($1, $2, $3, $4, $5)',
          [randomUUID(), randomUUID(), title, '{}', new Date(Date.now() + 60_000).toISOString()],
        );
        throw new Error('intentional rollback');
      }),
    ).rejects.toThrow('intentional rollback');

    const rows = await sql<{ count: string }[]>`
      select count(*)::text as count from shared_single_scenarios where title = ${title}
    `;
    expect(rows[0]?.count).toBe('0');
  });

  it('rolls back imported portfolio metadata and every lot together', async () => {
    const owner = `import-owner-${randomUUID()}`;
    const name = `import-${randomUUID()}`;
    await sql`insert into "user" (id, name) values (${owner}, 'Import owner')`;
    await expect(
      sql.begin(async (transaction) => {
        const portfolioId = randomUUID();
        await transaction.unsafe(
          'insert into user_portfolios (id, user_id, name) values ($1, $2, $3)',
          [portfolioId, owner, name],
        );
        await transaction.unsafe(
          "insert into user_investment_lots (id, portfolio_id, bond_type, purchase_date, amount) values ($1, $2, 'COI', '2026-01-01', 100)",
          [randomUUID(), portfolioId],
        );
        throw new Error('force import rollback');
      }),
    ).rejects.toThrow('force import rollback');
    const portfolios = await sql<
      { count: string }[]
    >`select count(*)::text as count from user_portfolios where name = ${name}`;
    expect(portfolios[0]?.count).toBe('0');
  });
});
