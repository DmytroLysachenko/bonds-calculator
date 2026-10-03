import { describe, expect, it } from 'vitest';

import {
  ADMITTED_PREVIEW_SMOKE_CHECKS,
  parseArgs,
  shouldRequireLoginProviderForm,
} from './verify-production';

describe('production verification options', () => {
  it('limits admitted-preview smoke routes to education, single calculator, and economic data', () => {
    expect(ADMITTED_PREVIEW_SMOKE_CHECKS.map((check) => check.path)).toEqual([
      '/api/health',
      '/education',
      '/single-calculator',
      '/economic-data',
      '/api/calculation-defaults',
      '/login',
    ]);
  });

  it('accepts explicit Cloud Run image and revision expectations', () => {
    expect(
      parseArgs([
        '--base-url',
        'https://app.example.com/',
        '--allow-missing-oauth',
        '--expected-image',
        'europe-west1-docker.pkg.dev/project/repo/app:sha',
        '--expected-revision',
        'obligacje-calculator-00042-abc',
      ]),
    ).toMatchObject({
      baseUrl: 'https://app.example.com',
      allowMissingOauth: true,
      expectedImage: 'europe-west1-docker.pkg.dev/project/repo/app:sha',
      expectedRevision: 'obligacje-calculator-00042-abc',
    });
  });

  it('does not require an OAuth provider form in an explicitly allowed private preview', () => {
    expect(shouldRequireLoginProviderForm({ allowMissingOauth: true })).toBe(false);
    expect(shouldRequireLoginProviderForm({ allowMissingOauth: false })).toBe(true);
  });
});
