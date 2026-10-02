import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

/** Callback transactions require a connection-oriented driver, unlike Neon HTTP. */
export function createTransactionClient(databaseUrl: string) {
  const connection = postgres(databaseUrl, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return {
    db: drizzle(connection, { schema }),
    close: () => connection.end({ timeout: 5 }),
  };
}
