import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOwnerSettings: vi.fn(),
  updateOwnerSettings: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/server/settings/service', () => ({
  updateOwnerSettings: mocks.updateOwnerSettings,
  getOwnerSettings: mocks.getOwnerSettings,
}));

import { GET, PATCH } from './route';

afterEach(() => vi.unstubAllEnvs());

describe('settings PATCH boundary', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    mocks.auth.mockReset();
    mocks.getOwnerSettings.mockReset();
    mocks.updateOwnerSettings.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: 'owner-1' } });
    mocks.updateOwnerSettings.mockResolvedValue({ theme: 'dark' });
  });

  it('rejects forged guest ownership before settings reads or writes', async () => {
    mocks.auth.mockResolvedValue(null);
    for (const [method, handler] of [
      ['GET', GET],
      ['PATCH', PATCH],
    ] as const) {
      const response = await handler(
        new NextRequest('http://localhost/api/user/settings', {
          method,
          headers: {
            cookie: 'guest_portfolio_owner_id=owner-1',
            'content-type': 'application/json',
          },
          ...(method === 'PATCH' ? { body: JSON.stringify({ theme: 'dark' }) } : {}),
        }),
        { params: Promise.resolve({}) },
      );
      expect(response.status).toBe(401);
    }
    expect(mocks.getOwnerSettings).not.toHaveBeenCalled();
    expect(mocks.updateOwnerSettings).not.toHaveBeenCalled();
  });

  it('accepts only supported settings values', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/user/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'dark', chartType: 'line' }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateOwnerSettings).toHaveBeenCalledWith('owner-1', {
      theme: 'dark',
      chartType: 'line',
    });
  });

  it('rejects unknown values and oversized bodies before settings persistence', async () => {
    const invalid = await PATCH(
      new NextRequest('http://localhost/api/user/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'attacker-controlled' }),
      }) as never,
      {} as never,
    );
    const tooLarge = await PATCH(
      new NextRequest('http://localhost/api/user/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'x'.repeat(9 * 1024) }),
      }) as never,
      {} as never,
    );

    expect(invalid.status).toBe(400);
    expect(tooLarge.status).toBe(413);
    expect(mocks.updateOwnerSettings).not.toHaveBeenCalled();
  });
});
