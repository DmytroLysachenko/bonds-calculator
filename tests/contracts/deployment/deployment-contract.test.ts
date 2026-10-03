import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const ciWorkflow = '.github/workflows/ci.yml';
const deployWorkflow = '.github/workflows/deploy-cloud-run.yml';
const rollbackWorkflow = '.github/workflows/rollback-cloud-run.yml';

describe('deployment configuration contract', () => {
  it('keeps Cloud Run deploy and rollback workflows guarded', () => {
    const deploy = readFileSync(join(root, deployWorkflow), 'utf8');
    const rollback = readFileSync(join(root, rollbackWorkflow), 'utf8');

    expect(deploy).toContain('workflow_dispatch');
    expect(deploy).toContain('refs/heads/main');
    expect(deploy).toContain('production-cloud-run');
    expect(deploy).toContain('--allow-unauthenticated');
    expect(deploy).toContain('Validate runtime secrets');
    expect(deploy).toContain('Apply reviewed database migrations');
    expect(deploy).toContain('pnpm exec drizzle-kit migrate');
    expect(deploy).toContain('Release gate');
    expect(deploy).toContain('pnpm check:release');
    expect(deploy).toContain('DATABASE_URL');
    expect(deploy).toContain('AUTH_SECRET');
    expect(deploy).toContain('SYNC_SECRET');
    expect(deploy).toContain('INNGEST_EVENT_KEY');
    expect(deploy).toContain('INNGEST_SIGNING_KEY');
    expect(deploy).toContain('Verify Inngest endpoint');
    expect(deploy).not.toContain('INNGEST_DEV');
    expect(deploy).toContain('pnpm ops:verify-prod');
    expect(deploy).toContain('--expected-image');
    expect(deploy).toContain('--expected-revision');
    expect(deploy).toContain('Capture deployed revision');
    expect(deploy).toContain('managed-by=github-actions');
    expect(deploy).toContain('--allow-missing-oauth');
    expect(deploy).toContain('docker buildx build');
    expect(deploy).toContain('type=gha');

    expect(rollback).toContain('workflow_dispatch');
    expect(rollback).toContain('production-cloud-run');
    expect(rollback).toContain('gcloud run services update-traffic');
    expect(rollback).toContain('--to-revisions');
    expect(rollback).toContain('pnpm ops:verify-prod');
    expect(rollback).toContain('--expected-revision');
  });

  it('keeps CI wired to release, browser, and performance gates', () => {
    const ci = readFileSync(join(root, ciWorkflow), 'utf8');

    expect(ci).toContain('pnpm test:release');
    expect(ci).toContain('docker-build');
    expect(ci).toContain('docker/build-push-action');
    expect(ci).toContain(
      'pnpm smoke:local -- --base-url http://127.0.0.1:8080 --check-content-type',
    );
    expect(ci).toContain('browser-smoke');
    expect(ci).toContain('Browser environment preflight');
    expect(ci).toContain('pnpm check:local-env -- --require-playwright');
    expect(ci).toContain('pnpm test:browser:ci');
    expect(ci).toContain('actions/upload-artifact');
    expect(ci).toContain('dependency-security');
    expect(ci).toContain('pnpm audit --prod --audit-level=high');
  });

  it('retains database test evidence after Playwright clears test-results', () => {
    const ci = readFileSync(join(root, ciWorkflow), 'utf8');

    expect(ci).toContain('--outputFile=artifacts/database-integration.json');
    expect(ci).toContain('path: artifacts/database-integration.json');
    expect(ci).not.toContain('test-results/database-integration.json');
  });

  it('keeps local container workflow discoverable and no-secret by default', () => {
    const compose = readFileSync(join(root, 'compose.yaml'), 'utf8');
    const taskfile = readFileSync(join(root, 'Taskfile.yml'), 'utf8');
    const envExample = readFileSync(join(root, '.env.example'), 'utf8');

    expect(compose).toContain('postgres:17-alpine');
    expect(compose).toContain('postgresql://obligacje:obligacje@postgres:5432/obligacje');
    expect(taskfile).toContain('dev:container');
    expect(taskfile).toContain('preflight');
    expect(taskfile).toContain('prod:container');
    expect(taskfile).toContain('smoke:container');
    expect(taskfile).toContain('smoke:prod-container');
    expect(taskfile).toContain('db:reset-local');
    expect(envExample).toContain('postgresql://obligacje:obligacje@localhost:5432/obligacje');
    expect(envExample).toContain('AUTH_GOOGLE_ID=');
  });

  it('keeps Cloud Build aligned with private Cloud Run preview policy', () => {
    const cloudBuild = readFileSync(join(root, 'cloudbuild.yaml'), 'utf8');
    const cloudBuildLines = cloudBuild.split(/\r?\n/).map((line) => line.trim());

    expect(cloudBuild).toContain('--allow-unauthenticated');
    expect(cloudBuild).toContain('pnpm check:release');
    expect(cloudBuild).toContain('--execution-environment');
    expect(cloudBuild).toContain('gen2');
    expect(cloudBuild).toContain('managed-by=cloud-build');
    expect(cloudBuildLines).not.toContain('- --no-allow-unauthenticated');
  });

  it('keeps Docker build context free of local artifacts and secrets', () => {
    const dockerignore = readFileSync(join(root, '.dockerignore'), 'utf8');

    for (const ignored of [
      '.git',
      '.next',
      '.vercel',
      '.turbo',
      'node_modules',
      '.env',
      '.env.*',
      'coverage',
      'test-results',
    ]) {
      expect(dockerignore).toContain(ignored);
    }

    expect(dockerignore).toContain('!.env.example');
  });
});
