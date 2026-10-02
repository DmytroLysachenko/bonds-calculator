import { existsSync, readFileSync } from 'node:fs';

export const integrationFixturePath = '.playwright-integration/fixture.json';

export interface IntegrationFixture {
  publicShareId: string;
  userId: string;
}

export function readIntegrationFixture(): IntegrationFixture {
  if (!existsSync(integrationFixturePath)) {
    throw new Error(
      'Integration fixture is missing. Run through playwright.integration.config.ts.',
    );
  }

  return JSON.parse(readFileSync(integrationFixturePath, 'utf8')) as IntegrationFixture;
}
