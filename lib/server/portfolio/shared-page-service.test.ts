import { describe, expect, it, vi } from 'vitest';

import { getPublicSharedPortfolioPageData } from './shared-page-service';

vi.mock('./repository', () => ({
  findPortfolioByShareId: vi.fn(async (shareId: string) => {
    if (shareId === 'missing') {
      return null;
    }

    if (shareId === 'private') {
      return {
        id: 'portfolio-private',
        name: 'Private Portfolio',
        description: 'Private description',
        isPublic: false,
      };
    }

    return {
      id: 'portfolio-public',
      userId: 'private-owner',
      name: 'Public Portfolio',
      description: 'Public description',
      isPublic: true,
    };
  }),
}));

describe('shared portfolio page service', () => {
  it('loads public shared portfolio data through the migrated schema', async () => {
    const portfolio = await getPublicSharedPortfolioPageData('public');

    expect(portfolio).toEqual({ name: 'Public Portfolio', description: 'Public description' });
  });

  it('filters missing and private shared portfolio records', async () => {
    await expect(getPublicSharedPortfolioPageData('missing')).resolves.toBeNull();
    await expect(getPublicSharedPortfolioPageData('private')).resolves.toBeNull();
  });
});
