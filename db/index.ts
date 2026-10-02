import 'dotenv/config';

import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
export const isDatabaseConfigured = Boolean(databaseUrl);

const createDbClient = () => {
  if (!databaseUrl) {
    console.warn('DATABASE_URL is not defined. Database operations will fail at runtime.');
    return {} as unknown as NeonHttpDatabase<typeof schema>;
  }
  // The authenticated local integration harness uses an isolated PostgreSQL
  // service, not a Neon HTTP endpoint. Keep this opt-in out of production.
  if (
    process.env.PLAYWRIGHT_INTEGRATION_DATABASE === 'postgres-js' &&
    process.env.TEST_DATABASE_URL === databaseUrl
  ) {
    return drizzlePostgres(postgres(databaseUrl, { max: 5 }), {
      schema,
    }) as unknown as NeonHttpDatabase<typeof schema>;
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
};

export const db = createDbClient();
