import { findPortfolioByShareId } from '@/lib/server/portfolio/repository';

async function getPublicSharedPortfolioByShareId(shareId: string) {
  const portfolio = await findPortfolioByShareId(shareId);

  if (!portfolio || !portfolio.isPublic) {
    return null;
  }

  return { name: portfolio.name, description: portfolio.description };
}

export async function getPublicSharedPortfolioPageData(shareId: string) {
  return getPublicSharedPortfolioByShareId(shareId);
}
