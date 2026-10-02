import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApiHandler } from './api-handler';
import { type RateLimiter } from './rate-limiter';
import { readJsonBody } from './read-json-body';

const CommandSchema = z.object({ operation: z.enum(['calculate', 'preview']) }).strict();

function createLimiter(): RateLimiter {
  return {
    consume: vi.fn().mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    }),
  };
}

function createRoute() {
  return createApiHandler({
    rateLimiter: createLimiter(),
    getIdentity: () => 'test-client',
  })(async (request) => {
    const command = await readJsonBody(request, CommandSchema, { maxBytes: 128 });
    return NextResponse.json({ command });
  });
}

function request(body: BodyInit | null, headers?: HeadersInit) {
  return new NextRequest('https://example.test/api/command', {
    method: 'POST',
    body,
    headers,
  });
}

describe('JSON command API boundary', () => {
  it('passes validated command to route implementation', async () => {
    const response = await createRoute()(
      request(JSON.stringify({ operation: 'calculate' }), { 'content-type': 'application/json' }),
      {} as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      command: { operation: 'calculate' },
      requestId: response.headers.get('x-request-id'),
    });
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns a safe stable 415 problem for a missing media type', async () => {
    const response = await createRoute()(
      request(JSON.stringify({ operation: 'calculate' })),
      {} as never,
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      detail: 'The request body must use application/json.',
    });
  });

  it('returns a safe stable 415 problem for form input', async () => {
    const response = await createRoute()(
      request('operation=calculate', { 'content-type': 'application/x-www-form-urlencoded' }),
      {} as never,
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('returns a safe stable 413 problem before parsing an oversized command', async () => {
    const response = await createRoute()(
      request(JSON.stringify({ operation: 'calculate', padding: 'x'.repeat(256) }), {
        'content-type': 'application/json',
      }),
      {} as never,
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      detail: "The request body exceeds this endpoint's size limit.",
    });
  });

  it('does not expose an accepted body when JSON is malformed', async () => {
    const response = await createRoute()(
      request('{"operation":', { 'content-type': 'application/json' }),
      {} as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'MALFORMED_JSON',
      detail: 'The request body must be valid JSON.',
    });
  });

  it('preserves field issues for schema-invalid JSON', async () => {
    const response = await createRoute()(
      request(JSON.stringify({ operation: 'delete' }), { 'content-type': 'application/json' }),
      {} as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: expect.any(Array),
    });
  });

  it('does not reveal malformed Content-Length internals', async () => {
    const response = await createRoute()(
      request(JSON.stringify({ operation: 'calculate' }), {
        'content-length': 'invalid',
        'content-type': 'application/json',
      }),
      {} as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST_BODY',
      detail: 'The request body is invalid.',
    });
  });

  it('keeps correlation IDs for command-body failures', async () => {
    const response = await createRoute()(
      request(null, { 'content-type': 'application/json', 'x-request-id': 'provided-request-id' }),
      {} as never,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBe('provided-request-id');
    await expect(response.json()).resolves.toMatchObject({ requestId: 'provided-request-id' });
  });
});
