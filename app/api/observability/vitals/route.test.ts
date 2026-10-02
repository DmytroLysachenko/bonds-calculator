import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { error, info, recordVitalAggregate, shouldSampleVital } = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  recordVitalAggregate: vi.fn(),
  shouldSampleVital: vi.fn(),
}));

vi.mock('@/lib/server/logging', () => ({
  createServerLogger: () => ({ error, info }),
}));
vi.mock('@/lib/server/observability/vital-aggregates', () => ({
  recordVitalAggregate,
  shouldSampleVital,
}));

import { POST } from './route';

describe('web vitals endpoint', () => {
  beforeEach(() => {
    info.mockClear();
    error.mockClear();
    recordVitalAggregate.mockReset();
    shouldSampleVital.mockReturnValue(false);
  });

  it('logs only validated anonymous metric fields', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/observability/vitals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'LCP', value: 1240, rating: 'good', path: '/education' }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    expect(info).toHaveBeenCalledWith('web_vital', {
      event: 'web_vital',
      metric: 'LCP',
      value: 1240,
      rating: 'good',
      path: '/education',
    });
  });

  it('persists a sampled aggregate with no request metadata', async () => {
    shouldSampleVital.mockReturnValue(true);
    recordVitalAggregate.mockResolvedValue({ persisted: true });

    const response = await POST(
      new NextRequest('http://localhost/api/observability/vitals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'INP', value: 120, rating: 'good', path: '/compare' }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    expect(recordVitalAggregate).toHaveBeenCalledWith({
      name: 'INP',
      value: 120,
      rating: 'good',
      path: '/compare',
      navigationType: 'navigate',
    });
  });

  it('removes shared-resource identifiers before logging or aggregation', async () => {
    shouldSampleVital.mockReturnValue(true);
    recordVitalAggregate.mockResolvedValue({ persisted: true });

    const response = await POST(
      new NextRequest('http://localhost/api/observability/vitals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'LCP',
          value: 100,
          rating: 'good',
          path: '/shared-portfolios/private-share-id',
        }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    expect(recordVitalAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/shared-portfolios' }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('private-share-id');
  });

  it('keeps the accepted response and emits a safe fallback when persistence fails', async () => {
    shouldSampleVital.mockReturnValue(true);
    recordVitalAggregate.mockRejectedValue(
      new Error('connection string must not leave the server'),
    );

    const response = await POST(
      new NextRequest('http://localhost/api/observability/vitals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'CLS', value: 1, rating: 'poor', path: '/ladder' }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith('Failed to persist web-vital aggregate', {
      errorType: 'Error',
      metric: 'CLS',
      rating: 'poor',
      path: '/ladder',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('connection string');
  });

  it('rejects query strings and arbitrary user data', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/observability/vitals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'LCP',
          value: 1,
          rating: 'good',
          path: '/?email=test@example.com',
        }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(400);
  });

  it('rejects oversized telemetry before decoding it', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/observability/vitals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '2049' },
        body: '{}',
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(413);
    expect(info).not.toHaveBeenCalled();
  });
});
