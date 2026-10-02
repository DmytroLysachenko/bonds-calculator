import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('portfolio service boundary', () => {
  it('keeps route handlers pointed at one portfolio application interface', () => {
    const route = read('app/api/portfolio/route.ts');
    const lotsRoute = read('app/api/portfolio/lots/route.ts');
    const shareRoute = read('app/api/portfolio/share/route.ts');
    const simulateRoute = read('app/api/portfolio/simulate/route.ts');

    for (const source of [route, lotsRoute, shareRoute, simulateRoute]) {
      expect(source).toContain("from '@/lib/server/portfolio/application'");
      expect(source).not.toContain("from '@/lib/server/portfolio/commands'");
      expect(source).not.toContain("from '@/lib/server/portfolio/queries'");
    }
  });

  it('keeps portfolio ownership reads available through the repository boundary', () => {
    const repository = read('lib/server/portfolio/repository.ts');
    const access = read('lib/server/portfolio/access.ts');

    expect(access).not.toContain("from '@/db'");
    expect(access).toContain("from '@/lib/server/portfolio/repository'");
    expect(access).toContain('findPortfolioByOwner(ownerId, portfolioId)');
    expect(access).toContain('findOwnedLotByOwner(ownerId, lotId)');
    expect(access).not.toContain('guest_portfolio_owner_id');
    expect(repository).toContain('export function findPortfolioByOwner');
    expect(repository).toContain('export async function findOwnedLotByOwner');
    expect(repository).not.toContain('ensureGuestPortfolioOwner');
    expect(repository).toContain('innerJoin(userPortfolios');
  });

  it('makes destructive operations owner-scoped at the repository boundary', () => {
    const repository = read('lib/server/portfolio/repository.ts');
    const commands = read('lib/server/portfolio/commands.ts');

    expect(repository).toContain('export function deletePortfolioByOwner');
    expect(repository).toContain('export function deleteLotByOwner');
    expect(repository).toContain('inArray(userInvestmentLots.portfolioId, ownedPortfolioIds)');
    expect(commands).toContain('deletePortfolioByOwner(ownerId, portfolioId)');
    expect(commands).toContain('deleteLotByOwner(ownerId, lotId)');
  });

  // Actual transaction/rollback behavior is covered by db/portfolio-repository.integration.test.ts.
});
