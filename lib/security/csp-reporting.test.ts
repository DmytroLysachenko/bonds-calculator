import { describe, expect, it } from 'vitest';

import { parseCspReport, shouldSampleCspReport } from './csp-reporting';

describe('CSP report privacy boundary', () => {
  it('keeps only origins and paths from a valid browser report', () => {
    expect(
      parseCspReport({
        'csp-report': {
          'blocked-uri': 'https://tracker.example.test/path?email=person@example.test#token',
          'document-uri': 'https://app.example.test/compare?scenario=private#result',
          'source-file': 'https://app.example.test/_next/client.js?build=secret',
          'effective-directive': "script-src 'self'",
          referrer: 'https://private.example.test/?account=123',
          'original-policy': "default-src 'self' nonce-secret",
        },
      }),
    ).toEqual({
      blockedOrigin: 'https://tracker.example.test',
      directive: 'script-src',
      documentPath: '/compare',
      sourcePath: '/_next/client.js',
    });
  });

  it('sanitizes a Reporting API CSP violation batch', () => {
    expect(
      parseCspReport([
        { type: 'network-error', body: { secret: 'not a CSP report' } },
        {
          type: 'csp-violation',
          url: 'https://app.example.test/compare?scenario=private',
          body: {
            blockedURL: 'inline',
            documentURL: 'https://app.example.test/compare?scenario=private',
            sourceFile: 'https://app.example.test/_next/devtools.js?token=secret',
            effectiveDirective: 'style-src-elem',
            originalPolicy: "style-src 'nonce-secret'",
          },
        },
      ]),
    ).toEqual({
      blockedOrigin: 'inline',
      directive: 'style-src-elem',
      documentPath: '/compare',
      sourcePath: '/_next/devtools.js',
    });
  });

  it('rejects malformed and oversized report bodies', () => {
    expect(parseCspReport({ 'csp-report': { unexpected: 'value' } })).toBeNull();
    expect(parseCspReport({ 'csp-report': { 'document-uri': 'x'.repeat(513) } })).toBeNull();
  });

  it('retains safe inline values without treating arbitrary strings as URLs', () => {
    expect(
      parseCspReport({
        'csp-report': { 'blocked-uri': 'inline', 'violated-directive': 'style-src-attr' },
      }),
    ).toMatchObject({ blockedOrigin: 'inline', directive: 'style-src-attr' });
    expect(
      parseCspReport({ 'csp-report': { 'blocked-uri': 'person@example.test' } }),
    ).toMatchObject({ blockedOrigin: null });
  });

  it('samples repetitive valid reports deterministically', () => {
    const report = {
      blockedOrigin: 'inline',
      directive: 'script-src',
      documentPath: '/',
      sourcePath: null,
    };

    expect(shouldSampleCspReport(report, 0.1, () => 0.09)).toBe(true);
    expect(shouldSampleCspReport(report, 0.1, () => 0.1)).toBe(false);
    expect(shouldSampleCspReport(report, 0)).toBe(false);
    expect(shouldSampleCspReport({ ...report, directive: null }, 0, () => 0.99)).toBe(false);
  });
});
