import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';

import { addRequestIdToProblem, getRequestId, withRequestId } from './request-context';

describe('request context', () => {
  it('retains a safe caller correlation identifier', () => {
    expect(
      getRequestId(
        new NextRequest('https://example.test', { headers: { 'x-request-id': 'request_1234' } }),
      ),
    ).toBe('request_1234');
  });

  it.each(['', 'short', 'a'.repeat(129), 'contains spaces', '<script>'])(
    'replaces unsafe id %s',
    (id) => {
      const result = getRequestId(
        new NextRequest('https://example.test', { headers: { 'x-request-id': id } }),
      );
      expect(result).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
      expect(result).not.toBe(id);
    },
  );

  it('returns the same id in response headers and public problems', () => {
    const response = withRequestId(NextResponse.json({ ok: false }), 'server_1234');
    expect(response.headers.get('x-request-id')).toBe('server_1234');
    expect(addRequestIdToProblem({ status: 500, code: 'FAILED' }, 'server_1234')).toEqual({
      status: 500,
      code: 'FAILED',
      requestId: 'server_1234',
    });
  });
});
