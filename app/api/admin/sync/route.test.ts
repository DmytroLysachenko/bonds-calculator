import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertAdminSessionAuthorization: vi.fn(),
  enqueueFinancialDataSync: vi.fn(),
}));

vi.mock('@/lib/server/admin/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/admin/service')>();
  return { ...actual, assertAdminSessionAuthorization: mocks.assertAdminSessionAuthorization };
});

vi.mock('@/lib/inngest', () => ({
  enqueueFinancialDataSync: mocks.enqueueFinancialDataSync,
}));

import { POST } from './route';

describe('admin sync route', () => {
  it('queues an authorized sync rather than running it in the request', async () => {
    mocks.enqueueFinancialDataSync.mockResolvedValue({ ids: ['evt_123'] });

    const response = await POST(
      new NextRequest('https://app.example.test/api/admin/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'market-history-sync' }),
      }),
      {} as never,
    );

    expect(response.status).toBe(202);
    expect(mocks.enqueueFinancialDataSync).toHaveBeenCalledWith({
      mode: 'market-history-sync',
      requestedBy: 'admin',
      requestId: expect.any(String),
    });
    await expect(response.json()).resolves.toMatchObject({
      data: {
        message: 'Sync queued successfully',
        mode: 'market-history-sync',
        eventIds: ['evt_123'],
      },
    });
  });
});
