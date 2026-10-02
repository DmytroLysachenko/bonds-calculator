import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  'lint-staged': Record<string, string[]>;
  scripts: Record<string, string>;
};

describe('package scripts contract', () => {
  it('keeps a single release-check command for Cloud Run promotion gates', () => {
    expect(pkg.scripts['check:types']).toBe('tsc --noEmit');
    expect(pkg.scripts['check:push']).toBe('pnpm check:types && pnpm test:core');
    expect(pkg.scripts['test:trusted-core']).toContain('single-bond-edge-golden.test.ts');
    expect(pkg.scripts['test:trusted-core']).toContain('economic-dashboard-model.test.ts');
    expect(pkg.scripts['test:trusted-core']).toContain('economic-data-semantic.test.tsx');
    expect(pkg.scripts['test:trusted-core']).toContain('education-entry-semantic.test.tsx');
    expect(pkg.scripts['test:trusted-core']).toContain('single-result-semantic.test.tsx');
    expect(pkg.scripts['test:trusted-core:browser']).toContain("--grep 'trusted-core routes'");
    expect(pkg.scripts['analyze:lighthouse']).toBe('tsx scripts/lighthouse-summary.ts');
    expect(pkg.scripts['test:release']).toContain('features/bond-core');
    expect(pkg.scripts['test:release']).toContain('lib/data/bond-series.test.ts');
    expect(pkg.scripts['test:release']).toContain('lib/seo/app-json-ld.test.ts');
    expect(pkg.scripts['test:release']).toContain('lib/sync/sync-engine.test.ts');
    expect(pkg.scripts['test:release']).toContain('lib/sync/sync-start-year.test.ts');
    expect(pkg.scripts['test:release']).toContain('app/api/production-readiness-contract.test.ts');
    expect(pkg.scripts['test:release']).toContain('app/api/operational-endpoints-contract.test.ts');
    expect(pkg.scripts['test:release']).toContain('app/provider-boundary-contract.test.ts');
    expect(pkg.scripts['test:release']).toContain(
      'tests/contracts/ui/interactive-trigger-markup-contract.test.ts',
    );
    expect(pkg.scripts['test:release']).toContain('scripts/check-production-config.test.ts');
    expect(pkg.scripts['test:release']).toContain('scripts/verify-production.test.ts');
    expect(pkg.scripts['test:release']).toContain('tests/browser/browser-diagnostics.test.ts');
    expect(pkg.scripts['test:release']).toContain(
      'tests/contracts/architecture/clean-code-contract.test.ts',
    );
    expect(pkg.scripts['test:browser']).toContain(
      'playwright test tests/browser/app-smoke.spec.ts',
    );
    expect(pkg.scripts['test:browser:ci']).toContain('tests/browser/app-smoke.spec.ts');
    expect(pkg.scripts['test:browser:ci']).toContain('tests/browser/home-page.spec.ts');
    expect(pkg.scripts['test:browser:ci']).toContain('tests/browser/issue-explorer.spec.ts');
    expect(pkg.scripts['test:browser:ci']).toContain('tests/browser/web-vitals.spec.ts');
    expect(pkg.scripts['test:browser:ci']).toContain('tests/browser/preferences.spec.ts');
    expect(pkg.scripts['test:browser:ci']).toContain('--workers=1');
    expect(pkg.scripts['test:browser:strict-csp']).toContain(
      'tests/browser/issue-explorer.spec.ts',
    );
    expect(pkg.scripts['test:browser:integration']).toBe(
      'playwright test --config playwright.integration.config.ts',
    );
    expect(pkg.scripts['test:db']).toContain('db/rate-limit-store.integration.test.ts');
    expect(pkg.scripts['test:web-vitals']).toContain(
      'playwright test tests/browser/web-vitals.spec.ts',
    );
    expect(pkg.scripts['test:home']).toBe('playwright test tests/browser/home-page.spec.ts');
    expect(pkg.scripts['check:release']).toContain('pnpm check:types');
    expect(pkg.scripts['check:release']).toContain('pnpm lint');
    expect(pkg.scripts['check:release']).toContain('pnpm test:release');
    expect(pkg.scripts['check:release']).toContain('pnpm build');
    expect(pkg.scripts['check:local-env']).toBe('tsx scripts/check-local-env.ts');
    expect(pkg.scripts['check:prod-config']).toBe('tsx scripts/check-production-config.ts');
    expect(pkg.scripts['check:release']).not.toContain('check:prod-config');
    expect(pkg.scripts['smoke:local']).toBe('tsx scripts/smoke-local.ts');
    expect(pkg.scripts['ops:verify-prod']).toBe('tsx scripts/verify-production.ts');
    expect(pkg.scripts['ops:cloud-run-status']).toBe('tsx scripts/cloud-run-status.ts');
    expect(pkg.scripts['deploy:prod']).toBe('gh workflow run deploy-cloud-run.yml --ref main');
    expect(pkg.scripts['gcp:proxy']).toContain('gcloud run services proxy obligacje-calculator');

    const smokeLocal = readFileSync(join(process.cwd(), 'scripts/smoke-local.ts'), 'utf8');
    expect(smokeLocal).toContain('--check-content-type');
    expect(smokeLocal).toContain('--route');
    expect(smokeLocal).toContain('--retries');
  });

  it('starts browser tests through the standalone-aware Playwright launcher', () => {
    const playwrightConfig = readFileSync(join(process.cwd(), 'playwright.config.ts'), 'utf8');
    const launcher = readFileSync(
      join(process.cwd(), 'scripts/start-playwright-server.mjs'),
      'utf8',
    );

    expect(playwrightConfig).toContain('node scripts/start-playwright-server.mjs');
    expect(playwrightConfig).toContain("screenshot: 'only-on-failure'");
    expect(playwrightConfig).toContain("video: 'retain-on-failure'");
    expect(playwrightConfig).toContain("name: 'mobile-chromium'");
    expect(launcher).toContain("existsSync('.next/standalone/server.js')");
    expect(launcher).toContain("process.platform !== 'win32'");
    expect(launcher).toContain("cpSync('.next/static'");
    expect(launcher).toContain('tmpdir()');
    expect(launcher).toContain('PLAYWRIGHT_SERVER_STDERR_FILE');
    expect(launcher).toContain("require.resolve('next/dist/bin/next')");
    expect(launcher).toContain("PLAYWRIGHT_SMOKE: process.env.PLAYWRIGHT_SMOKE ?? '1'");
    expect(launcher).toContain(
      "NEXT_PUBLIC_PLAYWRIGHT_SMOKE: process.env.NEXT_PUBLIC_PLAYWRIGHT_SMOKE ?? '1'",
    );

    const integrationConfig = readFileSync(
      join(process.cwd(), 'playwright.integration.config.ts'),
      'utf8',
    );
    const integrationLauncher = readFileSync(
      join(process.cwd(), 'scripts/start-playwright-integration-server.mjs'),
      'utf8',
    );
    expect(integrationConfig).toContain('bypassCSP: false');
    expect(integrationConfig).toContain('integration-global-setup.ts');
    expect(integrationConfig).toContain('integration-global-teardown.ts');
    expect(integrationConfig).toContain('shared-portfolios.spec.ts');
    expect(integrationLauncher).toContain("PLAYWRIGHT_SMOKE: '0'");
    expect(integrationLauncher).toContain("NEXT_PUBLIC_PLAYWRIGHT_SMOKE: '0'");
    expect(integrationLauncher).toContain(
      'TEST_DATABASE_URL must name an isolated disposable database.',
    );
  });

  it('keeps staged formatting fast and defers full checks to pre-push', () => {
    expect(pkg['lint-staged']['*.{ts,tsx}']).toEqual(['eslint --fix']);
    const prePushHook = readFileSync(join(process.cwd(), '.husky/pre-push'), 'utf8');
    expect(prePushHook).toContain('pnpm check:push');
  });
});
