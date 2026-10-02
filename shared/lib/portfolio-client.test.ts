import { describe, expect, it, vi } from 'vitest';

import { apiDelete, apiGet, apiGetWithResponse, apiPatch, apiPost } from './api-client';
import { portfolioClient } from './portfolio-client';

vi.mock('./api-client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiGetWithResponse: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

describe('portfolio client', () => {
  it('routes reads through the shared API client', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce([]);

    await portfolioClient.listPortfolios();

    expect(apiGet).toHaveBeenCalledWith('/api/portfolio');
  });

  it('reads workspace access through the standard enveloped API client', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({
      ownerId: 'owner-1',
      isGuest: false,
      authMode: 'authenticated',
      canManageWorkspace: true,
    });

    await portfolioClient.getAccess();

    expect(apiGet).toHaveBeenCalledWith('/api/portfolio/access');
  });

  it('routes portfolio lot creation through the shared API client', async () => {
    const input = {
      portfolioId: 'p1',
      bondType: 'EDO',
      purchaseDate: '2026-06-01',
      bondQuantity: 10,
      isRebought: false,
      selectedSeriesId: null,
    };

    vi.mocked(apiPost).mockResolvedValueOnce({ id: 'lot1' });

    await portfolioClient.createLot(input);

    expect(apiPost).toHaveBeenCalledWith('/api/portfolio/lots', input);
  });

  it('routes portfolio workspace operations through shared API primitives', async () => {
    vi.mocked(apiPost).mockResolvedValue({});
    vi.mocked(apiDelete).mockResolvedValue({});
    vi.mocked(apiPatch).mockResolvedValue({});
    vi.mocked(apiGet).mockResolvedValue([]);

    await portfolioClient.importPortfolio({ portfolio: { name: 'Import', lots: [] } });
    await portfolioClient.deletePortfolio('p1');
    await portfolioClient.listLots('p1');
    await portfolioClient.updateLot('lot1', { bondQuantity: 12 });
    await portfolioClient.deleteLot('lot1');
    await portfolioClient.simulatePortfolio('p1');
    await portfolioClient.toggleSharing('p1', true);

    expect(apiPost).toHaveBeenCalledWith('/api/portfolio/import', {
      portfolio: { name: 'Import', lots: [] },
    });
    expect(apiDelete).toHaveBeenCalledWith('/api/portfolio?id=p1');
    expect(apiGet).toHaveBeenCalledWith('/api/portfolio/lots?portfolioId=p1');
    expect(apiPatch).toHaveBeenCalledWith('/api/portfolio/lots/lot1', { bondQuantity: 12 });
    expect(apiDelete).toHaveBeenCalledWith('/api/portfolio/lots/lot1');
    expect(apiPost).toHaveBeenCalledWith('/api/portfolio/simulate', { portfolioId: 'p1' });
    expect(apiPost).toHaveBeenCalledWith('/api/portfolio/share', {
      portfolioId: 'p1',
      isPublic: true,
    });
  });

  it('preserves export response filename metadata', async () => {
    vi.mocked(apiGetWithResponse).mockResolvedValueOnce({
      data: { portfolio: { name: 'Demo' } },
      response: new Response(null, {
        headers: {
          'content-disposition': 'attachment; filename="demo_export.json"',
        },
      }),
    });

    await expect(
      portfolioClient.exportPortfolio({ id: 'p1', name: 'Demo Portfolio' }, 'package'),
    ).resolves.toEqual({
      data: { portfolio: { name: 'Demo' } },
      fileName: 'demo_export.json',
    });

    expect(apiGetWithResponse).toHaveBeenCalledWith(
      '/api/portfolio/export?portfolioId=p1&format=package',
    );
  });
});
