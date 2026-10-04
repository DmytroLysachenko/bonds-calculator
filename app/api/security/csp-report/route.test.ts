import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consume: vi.fn(() => ({ allowed: true, limit: 60, remaining: 59, resetAt: Date.now() + 60_000 })),
  warn: vi.fn(),
}));

vi.mock('@/lib/server/logging', () => ({
  createServerLogger: () => ({ error: vi.fn(), warn: mocks.warn }),
}));
vi.mock('@/lib/server/http/api-handler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/http/api-handler')>();
  return {
    ...actual,
    apiHandler: (handler: (request: Request) => Promise<Response>) => handler,
  };
});

import { POST } from './route';

describe('CSP report route', () => {
  beforeEach(() => {
    mocks.warn.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts valid browser reports without returning diagnostic data', async () => {
    const response = await POST(
      new Request('https://app.example.test/api/security/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/csp-report' },
        body: JSON.stringify({
          'csp-report': {
            'document-uri': 'https://app.example.test/compare?private=value',
            'effective-directive': 'script-src',
            'blocked-uri': 'inline',
          },
        }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
  });

  it('accepts batched Reporting API CSP reports', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const response = await POST(
      new Request('https://app.example.test/api/security/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/reports+json' },
        body: JSON.stringify([
          {
            type: 'csp-violation',
            body: {
              documentURL: 'https://app.example.test/compare?scenario=private',
              effectiveDirective: 'style-src-elem',
              blockedURL: 'inline',
            },
          },
        ]),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    expect(mocks.warn).toHaveBeenCalledWith('Sampled CSP violation', {
      blockedOrigin: 'inline',
      directive: 'style-src-elem',
      documentPath: '/compare',
      sourcePath: null,
    });
  });

  it('logs only sampled, redacted report fields', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const response = await POST(
      new Request('https://app.example.test/api/security/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/csp-report' },
        body: JSON.stringify({
          'csp-report': {
            'blocked-uri': 'https://tracker.example.test/pixel?email=person@example.test#token',
            'document-uri': 'https://app.example.test/compare?account=private#result',
            'source-file': 'https://app.example.test/_next/client.js?build=secret',
            'effective-directive': "script-src 'self'",
            referrer: 'https://private.example.test/?secret=must-not-log',
            'original-policy': "default-src 'self' nonce-secret",
          },
        }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    expect(mocks.warn).toHaveBeenCalledWith('Sampled CSP violation', {
      blockedOrigin: 'https://tracker.example.test',
      directive: 'script-src',
      documentPath: '/compare',
      sourcePath: '/_next/client.js',
    });
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('person@example.test');
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('nonce-secret');
  });

  it('rejects unrelated media types before parsing a body', async () => {
    const response = await POST(
      new Request('https://app.example.test/api/security/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json',
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      type: 'https://api.obligacje.pl/errors/unsupported-media-type',
      title: 'Unsupported Media Type',
      status: 415,
      detail:
        'CSP reports must use application/csp-report, application/reports+json, or application/json.',
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('does not echo malformed reports back to the browser', async () => {
    const response = await POST(
      new Request('https://app.example.test/api/security/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: 'must not appear in a response' }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
    expect(mocks.warn).not.toHaveBeenCalled();
  });
});
