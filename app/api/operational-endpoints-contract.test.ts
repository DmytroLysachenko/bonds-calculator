import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('operational endpoint contracts', () => {
  it('keeps admin status and sync routes thin and delegated to admin services', () => {
    const statusRoute = read('app/api/admin/status/route.ts');
    const syncRoute = read('app/api/admin/sync/route.ts');

    expect(statusRoute).toContain("from '@/lib/server/admin/service'");
    expect(statusRoute).toContain('getAdminStatusSnapshot');
    expect(statusRoute).toContain('assertAdminSessionAuthorization');
    expect(statusRoute).toContain('okJson(statusSnapshot)');
    expect(statusRoute).not.toContain('db.query');

    expect(syncRoute).toContain('createAdminSyncCommand');
    expect(syncRoute).toContain('enqueueFinancialDataSync');
    expect(syncRoute).toContain('{ status: 202 }');
    expect(syncRoute).toContain('readOptionalJsonBody');
    expect(syncRoute).not.toContain('z.object');
  });

  it('keeps readiness checks in the server readiness service', () => {
    const route = read('app/api/readiness/route.ts');
    const service = read('lib/server/readiness/service.ts');
    const runtimeEnv = read('lib/server/runtime/env.ts');

    expect(route).toContain("from '@/lib/server/readiness/service'");
    expect(route).toContain('getReadinessSnapshot');
    expect(route).not.toContain('postgres(');
    expect(route).not.toContain('DATABASE_URL');

    expect(service).toContain('REQUIRED_READINESS_TABLES');
    expect(service).toContain('DATABASE_URL');
    expect(service).toContain('AUTH_SECRET');
    expect(service).toContain('SYNC_SECRET');
    expect(service).toContain('Missing required tables');
    expect(service).toContain('readRuntimeEnv');
    expect(runtimeEnv).toContain('getDatabaseUrl');
    expect(runtimeEnv).toContain('getAuthSecret');
    expect(runtimeEnv).toContain('getConfiguredOAuthProviders');
  });

  it('keeps Auth.js provider runtime decisions behind server auth config', () => {
    const auth = read('auth.ts');
    const providerConfig = read('lib/server/auth/provider-config.ts');
    const providerConfigTest = read('lib/server/auth/provider-config.test.ts');

    expect(auth).toContain('getAuthRuntimeConfig');
    expect(auth).not.toContain('process.env.AUTH_GOOGLE_ID');
    expect(auth).not.toContain('process.env.AUTH_FACEBOOK_ID');
    expect(providerConfig).toContain("from '@/lib/server/runtime/env'");
    expect(providerConfig).toContain('getAuthRuntimeSecret');
    expect(providerConfig).toContain('getOAuthProviderCredentials');
    expect(providerConfig).toContain('getAuthRuntimeConfig');
    expect(providerConfigTest).toContain('keeps NEXTAUTH_SECRET compatibility');
    expect(providerConfigTest).toContain(
      'returns both provider credentials in deterministic order',
    );
  });

  it('keeps liveness and readiness as explicit operational endpoints', () => {
    const health = read('app/api/health/route.ts');
    const healthService = read('lib/server/health/service.ts');
    const readiness = read('app/api/readiness/route.ts');

    expect(health).toContain('createHealthPayload');
    expect(health).toContain('rawJson');
    expect(health).not.toContain(`NextResponse${'.json'}`);
    expect(healthService).toContain('MODEL_VERSION');
    expect(healthService).toContain('obligacje-calculator');
    expect(readiness).toContain('snapshot.ok ? 200 : 503');
    expect(`${health}\n${readiness}`).not.toContain('String(error)');
  });

  it('keeps calculation route parsing and envelopes on shared HTTP helpers', () => {
    const calculationRoute = read('lib/server/http/calculation-route.ts');

    expect(calculationRoute).toContain("from './read-json-body'");
    expect(calculationRoute).toContain("from './responses'");
    expect(calculationRoute.replace(/\s+/g, ' ')).toContain(
      'readJsonBody( req, scenarioSchemas[kind], )',
    );
    expect(calculationRoute).toContain('okJson(envelope)');
    expect(calculationRoute).not.toContain(`await req${'.json()'}`);
    expect(calculationRoute).not.toContain(`NextResponse${'.json'}`);
    expect(calculationRoute).not.toContain('createSuccessResponse');
  });

  it('keeps portfolio access enveloped and delegated to a pure payload helper', () => {
    const route = read('app/api/portfolio/access/route.ts');
    const payload = read('lib/server/portfolio/access-payload.ts');

    expect(route).toContain('okJson(createPortfolioAccessPayload(owner))');
    expect(route).toContain("from '@/lib/server/portfolio/access-payload'");
    expect(route).not.toContain(`NextResponse${'.json'}`);
    expect(route).not.toContain('canManageWorkspace:');
    expect(payload).toContain('canManageWorkspace');
    expect(payload).toContain("owner.authMode === 'authenticated'");
  });

  it('does not expose a public fire-and-forget synchronization endpoint', () => {
    expect(existsSync(join(root, 'app/api/sync/opportunistic/route.ts'))).toBe(false);
  });
});
