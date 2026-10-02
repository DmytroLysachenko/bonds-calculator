import { existsSync, readFileSync, rmSync } from 'node:fs';

import postgres from 'postgres';

import { type IntegrationFixture, integrationFixturePath } from './integration-fixture';

export default async function integrationGlobalTeardown() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const fixture = existsSync(integrationFixturePath)
    ? (JSON.parse(readFileSync(integrationFixturePath, 'utf8')) as IntegrationFixture)
    : null;

  try {
    if (databaseUrl && fixture) {
      const sql = postgres(databaseUrl, { max: 1 });
      try {
        await sql`delete from "user" where id = ${fixture.userId}`;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }
  } finally {
    rmSync('.playwright-integration', { force: true, recursive: true });
  }
}
