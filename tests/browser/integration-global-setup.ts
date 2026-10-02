import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { integrationFixturePath } from './integration-fixture';

const sessionStatePath = '.playwright-integration/session.json';

export default async function integrationGlobalSetup() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL must name an isolated disposable database.');
  }

  const baseURL = new URL(process.env.PLAYWRIGHT_INTEGRATION_BASE_URL ?? 'http://127.0.0.1:3200');
  const publicShareId = randomUUID();
  const userId = `playwright-integration-${randomUUID()}`;
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
    await sql`
      insert into polish_bonds (symbol, full_name, duration_days, interest_type)
      values ('COI', 'Four-year inflation-linked bond', 1461, 'inflation_linked')
      on conflict (symbol) do nothing
    `;
    await sql`
      insert into "user" (id, name, email)
      values (${userId}, 'Playwright Integration', ${`${userId}@example.test`})
    `;
    await sql`
      insert into session ("sessionToken", "userId", expires)
      values (${sessionToken}, ${userId}, ${expires.toISOString()})
    `;
    await sql`
      insert into user_portfolios (user_id, name, description, share_id, is_public)
      values (
        ${userId},
        'Playwright public portfolio',
        'Public fixture metadata only',
        ${publicShareId},
        true
      )
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }

  mkdirSync(dirname(sessionStatePath), { recursive: true });
  writeFileSync(
    sessionStatePath,
    JSON.stringify({
      cookies: [
        {
          name:
            baseURL.protocol === 'https:'
              ? '__Secure-authjs.session-token'
              : 'authjs.session-token',
          value: sessionToken,
          domain: baseURL.hostname,
          path: '/',
          expires: Math.floor(expires.getTime() / 1000),
          httpOnly: true,
          secure: baseURL.protocol === 'https:',
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );
  writeFileSync(integrationFixturePath, JSON.stringify({ publicShareId, userId }));
}
