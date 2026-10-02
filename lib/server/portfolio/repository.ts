import { and, eq, getTableColumns, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { userInvestmentLots, userPortfolios } from '@/db/schema';

export function listPortfoliosByOwner(ownerId: string) {
  return db.query.userPortfolios.findMany({
    where: eq(userPortfolios.userId, ownerId),
    orderBy: (portfolio, { desc }) => [desc(portfolio.updatedAt)],
  });
}

export function createPortfolio(ownerId: string, name: string, description?: string) {
  return db
    .insert(userPortfolios)
    .values({
      userId: ownerId,
      name,
      description,
    })
    .returning();
}

export function findPortfolioByOwner(ownerId: string, portfolioId: string) {
  return db.query.userPortfolios.findFirst({
    where: and(eq(userPortfolios.id, portfolioId), eq(userPortfolios.userId, ownerId)),
  });
}

export function findPortfolioByShareId(shareId: string) {
  return db.query.userPortfolios.findFirst({
    where: eq(userPortfolios.shareId, shareId),
  });
}

export function deletePortfolioByOwner(ownerId: string, portfolioId: string) {
  return db
    .delete(userPortfolios)
    .where(and(eq(userPortfolios.id, portfolioId), eq(userPortfolios.userId, ownerId)))
    .returning();
}

export function updatePortfolioVisibility(ownerId: string, portfolioId: string, isPublic: boolean) {
  return db
    .update(userPortfolios)
    .set({ isPublic, updatedAt: new Date() })
    .where(and(eq(userPortfolios.id, portfolioId), eq(userPortfolios.userId, ownerId)));
}

export function updatePortfolioByOwner(
  ownerId: string,
  portfolioId: string,
  values: { name?: string; description?: string },
) {
  return db
    .update(userPortfolios)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(userPortfolios.id, portfolioId), eq(userPortfolios.userId, ownerId)))
    .returning();
}

export function listLotsByPortfolio(portfolioId: string) {
  return db.query.userInvestmentLots.findMany({
    where: eq(userInvestmentLots.portfolioId, portfolioId),
    orderBy: (lot, { desc }) => [desc(lot.purchaseDate)],
  });
}

export function listLotsByPortfolioIds(portfolioIds: string[]) {
  if (portfolioIds.length === 0) {
    return Promise.resolve([]);
  }

  return db.query.userInvestmentLots.findMany({
    where: inArray(userInvestmentLots.portfolioId, portfolioIds),
  });
}

export async function findOwnedLotByOwner(ownerId: string, lotId: string) {
  const [lot] = await db
    .select({
      ...getTableColumns(userInvestmentLots),
    })
    .from(userInvestmentLots)
    .innerJoin(userPortfolios, eq(userInvestmentLots.portfolioId, userPortfolios.id))
    .where(and(eq(userInvestmentLots.id, lotId), eq(userPortfolios.userId, ownerId)))
    .limit(1);

  return lot;
}

export function createLot(values: typeof userInvestmentLots.$inferInsert) {
  return db.insert(userInvestmentLots).values(values).returning();
}

export function updateLotByOwner(
  ownerId: string,
  lotId: string,
  values: Partial<Omit<typeof userInvestmentLots.$inferInsert, 'id' | 'createdAt'>>,
) {
  const ownedPortfolioIds = db
    .select({ id: userPortfolios.id })
    .from(userPortfolios)
    .where(eq(userPortfolios.userId, ownerId));

  return db
    .update(userInvestmentLots)
    .set(values)
    .where(
      and(
        eq(userInvestmentLots.id, lotId),
        inArray(userInvestmentLots.portfolioId, ownedPortfolioIds),
        ...(values.portfolioId ? [sql`${values.portfolioId} in (${ownedPortfolioIds})`] : []),
      ),
    )
    .returning();
}

export function deleteLotByOwner(ownerId: string, lotId: string) {
  const ownedPortfolioIds = db
    .select({ id: userPortfolios.id })
    .from(userPortfolios)
    .where(eq(userPortfolios.userId, ownerId));

  return db
    .delete(userInvestmentLots)
    .where(
      and(
        eq(userInvestmentLots.id, lotId),
        inArray(userInvestmentLots.portfolioId, ownedPortfolioIds),
      ),
    )
    .returning();
}

export { createLotWithBuyTransaction, importPortfolioAtomically } from './atomic-writes';
