import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), status: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/server/admin/service', () => ({
  assertAdminSessionAuthorization: mocks.authorize,
  getAdminStatusSnapshot: mocks.status,
}));
vi.mock('@/lib/server/admin/audit', () => ({ recordAdminAuditEvent: mocks.audit }));

import { GET } from './route';

describe('admin status route', () => {
  it('records an authorized read with a correlation id', async () => {
    mocks.status.mockResolvedValue({ ok: true });
    const response = await GET(
      new Request('https://example.test/api/admin/status') as never,
      {} as never,
    );
    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith({
      action: 'status-read',
      requestId: expect.any(String),
    });
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('keeps unauthorized responses public and non-diagnostic', async () => {
    mocks.authorize.mockRejectedValueOnce(new Error('UNAUTHORIZED_ADMIN_SESSION'));
    const response = await GET(
      new Request('https://example.test/api/admin/status') as never,
      {} as never,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unauthorized',
      requestId: expect.any(String),
    });
  });
});
