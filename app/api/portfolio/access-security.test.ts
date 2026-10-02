import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), lots: vi.fn(), summary: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/server/portfolio/application', () => ({
  portfolioApplication: {
    listPortfolios: mocks.list,
    listLots: mocks.lots,
    loadSummary: mocks.summary,
  },
}));
import { apiGet } from '@/shared/lib/api-client';

import { GET as access } from './access/route';
import { GET as lots } from './lots/route';
import { GET as summary } from './summary/route';
import { GET as list } from './route';

const context = { params: Promise.resolve({}) };
function request(path: string) {
  return new NextRequest(`https://test.local${path}`, {
    headers: { cookie: 'guest_portfolio_owner_id=victim' },
  });
}
beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-auth-secret');
  mocks.auth.mockReset();
  mocks.list.mockReset();
  mocks.lots.mockReset();
  mocks.summary.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe('portfolio identity and wire contract', () => {
  it('does not let a forged guest cookie select any private owner', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await list(request('/api/portfolio'), context);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('blocks forged-cookie lot and summary reads before any private query', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await lots(request('/api/portfolio/lots?portfolioId=foreign'), context)).status).toBe(
      401,
    );
    const response = await summary(request('/api/portfolio/summary'), context);
    expect((await response.json()).data.items).toEqual([]);
    expect(mocks.lots).not.toHaveBeenCalled();
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('provides a nonprivate preview if auth is not configured', async () => {
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('NEXTAUTH_SECRET', '');
    const response = await access(request('/api/portfolio/access'), context);
    expect((await response.json()).data).toMatchObject({
      isGuest: true,
      canManageWorkspace: false,
      authMode: 'auth_unavailable_guest_fallback',
    });
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it('uses the verified session rather than the supplied guest cookie', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'alice' } });
    mocks.list.mockResolvedValue([{ name: 'Alice portfolio' }]);
    const response = await list(request('/api/portfolio'), context);
    expect(mocks.list).toHaveBeenCalledWith('alice');
    expect((await response.json()).data).toEqual([{ name: 'Alice portfolio' }]);
  });
  it('decodes the real access route through the browser client exactly once', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'alice' } });
    const response = await access(request('/api/portfolio/access'), context);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    try {
      await expect(apiGet('/api/portfolio/access')).resolves.toMatchObject({
        ownerId: 'alice',
        canManageWorkspace: true,
        isGuest: false,
      });
    } finally {
      fetch.mockRestore();
    }
  });
});
