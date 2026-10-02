import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  closePortfolioTransactionConnection,
  createLotWithBuyTransaction,
  importPortfolioAtomically,
} from '@/lib/server/portfolio/atomic-writes';

const url = process.env.TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration('portfolio runtime atomic adapter', () => {
  let sql: Sql;
  const owner = `atomic-${randomUUID()}`;
  beforeAll(async () => {
    vi.stubEnv('DATABASE_TRANSACTION_URL', url!);
    sql = postgres(url!, { max: 1 });
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
    await sql`insert into "user" (id, name) values (${owner}, 'Atomic test')`;
  });
  afterAll(async () => {
    await closePortfolioTransactionConnection();
    await sql`delete from "user" where id = ${owner}`;
    await sql.end({ timeout: 2 });
    vi.unstubAllEnvs();
  });

  it('commits an import through the selected runtime adapter', async () => {
    const result = await importPortfolioAtomically(owner, {
      name: 'Atomic',
      lots: [{ bondType: 'COI', purchaseDate: '2026-01-01', amount: '3' }],
    });
    expect(result.importedLots).toBe(1);
    expect(result.portfolio.name).toBe('Atomic (Imported)');
    const rows =
      await sql`select amount::text from user_investment_lots where portfolio_id = ${result.portfolio.id}`;
    expect(Number(rows[0].amount)).toBe(3);
  });

  it('rolls metadata back when a later imported lot violates a constraint', async () => {
    await expect(
      importPortfolioAtomically(owner, {
        name: 'Rollback',
        lots: [{ bondType: 'COI', purchaseDate: '2026-01-01', amount: '-1' }],
      }),
    ).rejects.toThrow();
    const rows =
      await sql`select id from user_portfolios where user_id = ${owner} and name = 'Rollback (Imported)'`;
    expect(rows).toHaveLength(0);
  });

  it('commits the lot and exact buy value together', async () => {
    const [portfolio] =
      await sql`insert into user_portfolios (user_id, name) values (${owner}, 'Buy') returning id`;
    const lot = await createLotWithBuyTransaction({
      portfolioId: portfolio.id,
      bondType: 'COI',
      purchaseDate: '2026-01-01',
      amount: '3',
    });
    const rows =
      await sql`select amount::text, transaction_type from user_transactions where lot_id = ${lot.id}`;
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(300);
    expect(rows[0].transaction_type).toBe('buy');
  });

  it('rolls a lot back when the subsequent buy insert fails', async () => {
    const [portfolio] =
      await sql`insert into user_portfolios (user_id, name) values (${owner}, 'Rollback buy') returning id`;
    // A scoped trigger injects a failure in the second write without replacing the adapter.
    await sql.unsafe(
      `CREATE OR REPLACE FUNCTION reject_test_buy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM user_investment_lots WHERE id = NEW.lot_id AND portfolio_id = '${portfolio.id}') THEN RAISE EXCEPTION 'forced buy failure'; END IF; RETURN NEW; END $$`,
    );
    await sql.unsafe(
      'CREATE TRIGGER reject_test_buy BEFORE INSERT ON user_transactions FOR EACH ROW EXECUTE FUNCTION reject_test_buy()',
    );
    try {
      await expect(
        createLotWithBuyTransaction({
          portfolioId: portfolio.id,
          bondType: 'COI',
          purchaseDate: '2026-01-01',
          amount: '1',
        }),
      ).rejects.toThrow();
      expect(
        await sql`select id from user_investment_lots where portfolio_id = ${portfolio.id}`,
      ).toHaveLength(0);
    } finally {
      await sql.unsafe('DROP TRIGGER reject_test_buy ON user_transactions');
      await sql.unsafe('DROP FUNCTION reject_test_buy()');
    }
  });
});
