import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('production readiness contract', () => {
  it('keeps Cloud Run container artifacts checked in', () => {
    const dockerfile = read('Dockerfile');
    const cloudbuild = read('cloudbuild.yaml');

    expect(dockerfile).toMatch(/FROM node:24-bookworm-slim@sha256:[a-f0-9]{64} AS base/);
    expect(dockerfile).toContain('ENV NODE_ENV=production');
    expect(dockerfile).toContain('ENV HOSTNAME=0.0.0.0');
    expect(dockerfile).toContain('ENV PORT=8080');
    expect(dockerfile).toContain('COPY --from=builder --chown=node:node /app/.next/standalone ./');
    expect(dockerfile).toContain(
      'COPY --from=builder --chown=node:node /app/.next/static ./.next/static',
    );
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('EXPOSE 8080');
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(cloudbuild).toContain('gcr.io/cloud-builders/docker');
    expect(cloudbuild).toContain('gcr.io/google.com/cloudsdktool/cloud-sdk');
    expect(cloudbuild).toContain('run');
    expect(cloudbuild).toContain('deploy');
    expect(cloudbuild).toContain('--port');
    expect(cloudbuild).toMatch(/['"]8080['"]/);
    expect(read('next.config.ts')).toContain("output: 'standalone'");
  });

  it('keeps Cloud Build deploy substitutions and image tags stable', () => {
    const cloudbuild = read('cloudbuild.yaml');

    for (const substitution of [
      '_REGION: europe-central2',
      '_SERVICE: obligacje-calculator',
      '_AR_REPOSITORY: obligacje-calculator',
    ]) {
      expect(cloudbuild).toContain(substitution);
    }

    expect(cloudbuild).toContain(
      '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_AR_REPOSITORY}/${_SERVICE}:$SHORT_SHA',
    );
    expect(cloudbuild).toContain(
      '${_REGION}-docker.pkg.dev/$PROJECT_ID/${_AR_REPOSITORY}/${_SERVICE}:latest',
    );
    expect(cloudbuild).toContain('--allow-unauthenticated');
    expect(cloudbuild).toContain('--platform');
    expect(cloudbuild).toContain('managed');
    expect(cloudbuild).toContain('pnpm check:release');
    expect(cloudbuild).toContain('--execution-environment');
    expect(cloudbuild).toContain('gen2');
  });

  it('exposes liveness and readiness routes with safe checks', () => {
    const health = read('app/api/health/route.ts');
    const healthService = read('lib/server/health/service.ts');
    const readiness = read('app/api/readiness/route.ts');
    const readinessService = read('lib/server/readiness/service.ts');
    const runtimeEnv = read('lib/server/runtime/env.ts');

    expect(health).toContain('createHealthPayload');
    expect(healthService).toContain('MODEL_VERSION');
    expect(readiness).toContain('getReadinessSnapshot');
    expect(readinessService).toContain('getDatabaseUrl');
    expect(readinessService).toContain('hasAuthSecret');
    expect(readinessService).toContain('getSyncSecret');
    expect(readinessService).toContain('hasOAuthProvider');
    expect(runtimeEnv).toContain('DATABASE_URL');
    expect(runtimeEnv).toContain('AUTH_SECRET');
    expect(runtimeEnv).toContain('SYNC_SECRET');
    expect(readinessService).toContain('Missing required tables');
    expect(`${readiness}\n${readinessService}`).not.toContain('String(error)');
  });

  it('keeps production auth and env decisions centralized', () => {
    const auth = read('auth.ts');
    const runtimeEnv = read('lib/server/runtime/env.ts');
    const providerConfig = read('lib/server/auth/provider-config.ts');

    expect(auth).toContain('getAuthRuntimeConfig');
    expect(auth).not.toContain('process.env.AUTH_SECRET');
    expect(auth).not.toContain('process.env.AUTH_GOOGLE_ID');
    expect(runtimeEnv).toContain('readRuntimeEnv');
    expect(runtimeEnv).toContain('getConfiguredOAuthProviders');
    expect(providerConfig).toContain('getAuthRuntimeSecret');
    expect(providerConfig).toContain('getOAuthProviderCredentials');
    expect(providerConfig).toContain('obligacje-calculator-dev-secret');
  });

  it('keeps the Cloud Run release gate wired into package scripts', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };
    const prodConfigScript = read('scripts/check-production-config.ts');

    expect(packageJson.scripts['test:release']).toContain(
      'app/api/production-readiness-contract.test.ts',
    );
    expect(packageJson.scripts['test:release']).toContain(
      'scripts/check-production-config.test.ts',
    );
    expect(packageJson.scripts['check:release']).toBe(
      'pnpm check:types && pnpm lint && pnpm test:release && pnpm build',
    );
    expect(packageJson.scripts['check:prod-config']).toBe('tsx scripts/check-production-config.ts');
    expect(prodConfigScript).toContain('getConfiguredOAuthProviders');
    expect(prodConfigScript).toContain('getDatabaseUrl');
    expect(prodConfigScript).toContain('hasAuthSecret');
    expect(prodConfigScript).toContain('getSyncSecret');
    expect(prodConfigScript).toContain('--allow-missing-oauth');
    expect(prodConfigScript).toContain('isStrongSecret');

    const productionVerifier = read('scripts/verify-production.ts');
    expect(productionVerifier).toContain('ADMITTED_PREVIEW_SMOKE_CHECKS');
    expect(productionVerifier).toContain("path: '/education'");
    expect(productionVerifier).toContain("path: '/single-calculator'");
    expect(productionVerifier).toContain("path: '/economic-data'");
    expect(productionVerifier).toContain("path: '/login'");
    expect(productionVerifier).not.toContain("label: 'home'");
    expect(productionVerifier).toContain('verifyExpectedRevision');
    expect(productionVerifier).toContain('login OAuth readiness ok');
  });
});
