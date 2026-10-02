import { userInvestmentLots, userPortfolios, userTransactions } from '@/db/schema';
import { createTransactionClient } from '@/db/transaction-client';

let client: ReturnType<typeof createTransactionClient> | undefined;
function getTransactionDb() {
  if (!client) {
    const url = process.env.DATABASE_TRANSACTION_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error('Portfolio transaction connection is not configured');
    client = createTransactionClient(url);
  }
  return client.db;
}

/** Explicit lifecycle for isolated integration environments and graceful shutdown. */
export async function closePortfolioTransactionConnection() {
  const current = client;
  client = undefined;
  await current?.close();
}

export async function createLotWithBuyTransaction(values: typeof userInvestmentLots.$inferInsert) {
  return getTransactionDb().transaction(async (tx) => {
    const [newLot] = await tx.insert(userInvestmentLots).values(values).returning();

    await tx.insert(userTransactions).values({
      lotId: newLot.id,
      transactionType: 'buy',
      date: values.purchaseDate,
      amount: (Number(values.amount) * 100).toString(),
    });

    return newLot;
  });
}

type PreparedPortfolioImportLot = Omit<typeof userInvestmentLots.$inferInsert, 'portfolioId'>;

/** One transaction owns imported portfolio, lots, and rollback semantics. */
export async function importPortfolioAtomically(
  ownerId: string,
  input: { name: string; description?: string; lots: PreparedPortfolioImportLot[] },
) {
  return getTransactionDb().transaction(async (tx) => {
    const [portfolio] = await tx
      .insert(userPortfolios)
      .values({ userId: ownerId, name: `${input.name} (Imported)`, description: input.description })
      .returning();

    const lots = await tx
      .insert(userInvestmentLots)
      .values(input.lots.map((lot) => ({ ...lot, portfolioId: portfolio.id })))
      .returning();

    return { portfolio, importedLots: lots.length };
  });
}
