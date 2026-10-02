import postgres from 'postgres';

import {
  getDatabaseUrl,
  getPublicAppUrl,
  getSyncSecret,
  hasAuthSecret,
  hasOAuthProvider,
  isOAuthOptionalPreview,
  readRuntimeEnv,
  type RuntimeEnv,
} from '@/lib/server/runtime/env';

type ReadinessCheckStatus = 'ok' | 'failed';

export interface ReadinessCheck {
  status: ReadinessCheckStatus;
  detail?: string;
}

export interface ReadinessSnapshot {
  ok: boolean;
  checks: {
    env: ReadinessCheck;
    database: ReadinessCheck;
  };
  timestamp: string;
}

export type ReadinessEnv = RuntimeEnv;

export type SqlClient = {
  <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  (values: readonly string[]): unknown;
  end: (options: { timeout: number }) => Promise<void>;
};

type SqlFactory = (databaseUrl: string) => SqlClient;

export const REQUIRED_READINESS_TABLES = [
  'data_series',
  'data_points',
  'polish_bonds',
  'sync_runs',
  'user',
  'account',
  'session',
  'verificationToken',
  'shared_single_scenarios',
  'admin_audit_events',
  'rate_limit_windows',
  'web_vital_aggregates',
  'bond_series',
  'user_transactions',
];
const DRIZZLE_MIGRATIONS_TABLE = 'drizzle.__drizzle_migrations';
/** Bump with every reviewed migration added to the journal. */
export const REQUIRED_MIGRATION_COUNT = 13;
/** SHA-256 hashes of the complete reviewed Drizzle journal, in migration order. */
export const REQUIRED_MIGRATION_HASHES = [
  '0f4eecdf14be3137035a8807afcafdf6d2159924dadd276531c78d0d72a25257',
  '7b7b56dbf957d400db99938cf5ee3bd968b526a8a18a9f2f61b4341283c6c286',
  '4fedd0b7214ee33d4507c71bcd79ac65241c925836b0d0f7305b7a9e435a4d39',
  '4ae30fef07a1924ad7afcd0a066a07c8d946dd85edde86e675f059d57c6d5417',
  'a6a7525f648cc7287e7f2318ffb43bd62f981db336d13e27bd7378b50971a79f',
  'e552d13f52377417cad6c491606bc3d6b1c071760fde00e4fa25b6ef7c7e1958',
  '6eb8d4e281ffea14283ac94ca078e4b34deff85a4dc4a35fca471984beb4310e',
  '6fc6efbb29b8cd445b843f4d4e42102e731b7f27e8d3867d298cd3819953e318',
  'e699eb7886b491bfadb5268293cb524068670ba48934eca91f5288283c9aa307',
  '18f427f3c035180ef1dc77f6be3f70c1aeb084c7ce9a42f66e13ffc28a303c38',
  'c4aa1849e83c59e3b8d3b9a1761f50797c226a77ad077c24dccb134dc3f7d3d0',
  '5ac76092b338827be6f8e1bb597889524c69890e7673c82abdba96bbc06a2cb4',
  '644910352604010e81c666aafe3acb29a74a4670d01f04b2eca74bbfc630ab51',
] as const;

export function checkReadinessEnv(env: ReadinessEnv): ReadinessCheck {
  const missing = [
    !getDatabaseUrl(env) ? 'DATABASE_URL' : null,
    !hasAuthSecret(env) ? 'AUTH_SECRET' : null,
    !getSyncSecret(env) ? 'SYNC_SECRET' : null,
    !getPublicAppUrl(env) ? 'NEXT_PUBLIC_APP_URL' : null,
    !hasOAuthProvider(env) && !isOAuthOptionalPreview(env) ? 'OAUTH_PROVIDER' : null,
  ].filter((value): value is string => Boolean(value));

  return missing.length === 0
    ? { status: 'ok' }
    : { status: 'failed', detail: `Missing required runtime configuration: ${missing.join(', ')}` };
}

export async function checkReadinessDatabase(
  databaseUrl: string | undefined,
  createSqlClient: SqlFactory = (url) =>
    postgres(url, { max: 1, idle_timeout: 3, connect_timeout: 5 }) as SqlClient,
): Promise<ReadinessCheck> {
  if (!databaseUrl) {
    return { status: 'failed', detail: 'DATABASE_URL is not configured' };
  }

  const sql = createSqlClient(databaseUrl);

  try {
    await sql`select 1`;
    const rows = await sql<{ table_schema: string; table_name: string }[]>`
      select table_schema, table_name
      from information_schema.tables
      where (table_schema = 'public' and table_name in ${sql(REQUIRED_READINESS_TABLES)})
        or (table_schema = 'drizzle' and table_name = '__drizzle_migrations')
    `;
    const existingTables = new Set(rows.map((row) => `${row.table_schema}.${row.table_name}`));
    const missingTables = [
      ...REQUIRED_READINESS_TABLES.filter((table) => !existingTables.has(`public.${table}`)),
      ...(existingTables.has(DRIZZLE_MIGRATIONS_TABLE) ? [] : [DRIZZLE_MIGRATIONS_TABLE]),
    ];

    if (missingTables.length > 0) {
      return { status: 'failed', detail: `Missing required tables: ${missingTables.join(', ')}` };
    }

    const migrationRows = await sql<{ hash: string }[]>`
      select hash from drizzle.__drizzle_migrations order by created_at asc, id asc
    `;
    const appliedHashes = new Set(migrationRows.map((row) => row.hash));
    const missingMigrationHashes = REQUIRED_MIGRATION_HASHES.filter(
      (hash) => !appliedHashes.has(hash),
    );

    if (migrationRows.length < REQUIRED_MIGRATION_COUNT || missingMigrationHashes.length > 0) {
      return {
        status: 'failed',
        detail: `Database migration journal is incomplete: expected ${REQUIRED_MIGRATION_COUNT} reviewed migrations, found ${migrationRows.length}`,
      };
    }

    return { status: 'ok' };
  } catch {
    return { status: 'failed', detail: 'Database readiness check failed' };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function getReadinessSnapshot({
  env = readRuntimeEnv(),
  createSqlClient,
  now = new Date(),
}: {
  env?: ReadinessEnv;
  createSqlClient?: SqlFactory;
  now?: Date;
} = {}): Promise<ReadinessSnapshot> {
  const checks = {
    env: checkReadinessEnv(env),
    database: await checkReadinessDatabase(getDatabaseUrl(env), createSqlClient),
  };
  const ok = Object.values(checks).every((check) => check.status === 'ok');

  return {
    ok,
    checks,
    timestamp: now.toISOString(),
  };
}
