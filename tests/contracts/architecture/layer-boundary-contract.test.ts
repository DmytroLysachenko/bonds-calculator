import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const codeRoots = ['app', 'features', 'shared', 'lib'];
const codeExtensions = new Set(['.ts', '.tsx']);

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function listCodeFiles(directory: string): string[] {
  const absoluteDirectory = join(root, directory);

  return readdirSync(absoluteDirectory).flatMap((entry) => {
    const absolutePath = join(absoluteDirectory, entry);
    const relativePath = relative(root, absolutePath).replace(/\\/g, '/');
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') {
        return [];
      }
      return listCodeFiles(relativePath);
    }

    const extension = relativePath.slice(relativePath.lastIndexOf('.'));
    return codeExtensions.has(extension) ? [relativePath] : [];
  });
}

function listMatchingFiles(pattern: RegExp) {
  return codeRoots.flatMap(listCodeFiles).filter((file) => pattern.test(read(file)));
}

describe('layer boundary contract', () => {
  it('keeps calculation endpoint literals centralized in the shared endpoint registry', () => {
    const endpointLiteral =
      /['"`]\/api\/calculate\/(?:single|regular|compare|optimize|retirement)['"`]/;
    const matches = listMatchingFiles(endpointLiteral)
      .filter((file) => file !== 'shared/lib/calculation-endpoints.ts')
      .filter((file) => file !== 'shared/lib/calculation-endpoints.test.ts');

    expect(matches).toEqual([]);
  });

  it('keeps migrated portfolio UI clients behind the portfolio gateway', () => {
    const clients = [
      'shared/hooks/useWorkspacePortfolios.ts',
      'shared/hooks/usePortfolioAccess.ts',
      'features/single-calculator/lib/single-calculator-actions.ts',
      'features/notebook/hooks/usePortfolioDetailsWorkspace.ts',
    ];

    for (const client of clients) {
      const source = read(client);

      expect(source, client).toContain("from '@/shared/lib/portfolio-client'");
      expect(source, client).not.toMatch(/fetch\([^)]*\/api\/portfolio/);
    }

    const notebookController = read('features/notebook/hooks/useNotebookWorkspaceController.ts');
    const notebookContainer = read('features/notebook/components/NotebookContainer.tsx');
    const workspaceResource = read('shared/hooks/useWorkspacePortfolios.ts');

    expect(notebookController).toContain("from '@/shared/hooks/useWorkspacePortfolios'");
    expect(workspaceResource).toContain('canManageWorkspace: access.canManageWorkspace');
    expect(notebookController).toContain('canManageWorkspace: workspace.canManageWorkspace');
    expect(notebookContainer).toContain(
      "from '@/features/notebook/hooks/useNotebookWorkspaceController'",
    );
    expect(notebookContainer).toContain("from './portfolio-details/PortfolioDetails'");
    expect(notebookContainer).not.toContain("from '@/shared/hooks/usePortfolioAccess'");
    expect(notebookContainer).not.toMatch(/fetch\([^)]*\/api\/portfolio/);
  });

  it('keeps the calculator timeline renderer behind its subfeature entry', () => {
    const details = read('features/single-calculator/components/BondCalculatorDetailsContent.tsx');
    const timeline = read('features/single-calculator/components/timeline/BondTimeline.tsx');

    expect(details).toContain("import('./timeline/BondTimeline')");
    expect(timeline).toContain("from '@/features/single-calculator/types/timeline'");
  });

  it('prevents new browser and feature server dependencies', () => {
    const forbiddenImports = /from ['"]@\/(?:db|lib\/server)(?:\/|['"])/;
    const matches = listMatchingFiles(forbiddenImports)
      .filter((file) => file.startsWith('features/') || file.startsWith('shared/'))
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'));

    // Existing server composition debt is tracked by audit roadmap R09.
    // The type-only schema barrel is the documented current DTO exception.
    expect(matches.sort()).toEqual(['shared/types/portfolio.ts']);
  });

  it('keeps portfolio route controllers on the application interface', () => {
    const routeFiles = [
      'app/api/portfolio/route.ts',
      'app/api/portfolio/lots/route.ts',
      'app/api/portfolio/lots/[id]/route.ts',
      'app/api/portfolio/lots/save/route.ts',
      'app/api/portfolio/share/route.ts',
      'app/api/portfolio/simulate/route.ts',
      'app/api/portfolio/import/route.ts',
      'app/api/portfolio/export/route.ts',
      'app/api/portfolio/summary/route.ts',
    ];

    for (const routeFile of routeFiles) {
      const source = read(routeFile);

      expect(source, routeFile).not.toMatch(/from ['"]@\/lib\/server\/portfolio\/service['"]/);
      expect(source, routeFile).toMatch(/from ['"]@\/lib\/server\/portfolio\/application['"]/);
    }
  });

  it('keeps simple API controllers on shared response helpers', () => {
    const routeFiles = [
      'app/api/bond-definitions/route.ts',
      'app/api/calculation-defaults/route.ts',
      'app/api/calculate/bond-series/route.ts',
      'app/api/charts/multi-asset-history/route.ts',
      'app/api/charts/inflation/route.ts',
      'app/api/charts/nbp-rate/route.ts',
      'app/api/admin/status/route.ts',
      'app/api/admin/sync/route.ts',
      'app/api/scenarios/share/route.ts',
      'app/api/user/settings/route.ts',
    ];

    for (const routeFile of routeFiles) {
      const source = read(routeFile);

      expect(source, routeFile).toContain("from '@/lib/server/http/responses'");
      expect(source, routeFile).not.toContain('NextResponse.json');
    }
  });

  it('keeps migrated portfolio controllers on shared response helpers', () => {
    const routeFiles = [
      'app/api/portfolio/route.ts',
      'app/api/portfolio/lots/route.ts',
      'app/api/portfolio/lots/[id]/route.ts',
      'app/api/portfolio/lots/save/route.ts',
      'app/api/portfolio/share/route.ts',
      'app/api/portfolio/simulate/route.ts',
      'app/api/portfolio/import/route.ts',
      'app/api/portfolio/export/route.ts',
      'app/api/portfolio/summary/route.ts',
    ];

    for (const routeFile of routeFiles) {
      const source = read(routeFile);

      expect(source, routeFile).toContain("from '@/lib/server/http/responses'");
      expect(source, routeFile).not.toContain('NextResponse.json');
      expect(source, routeFile).not.toContain('createSuccessResponse');
    }
  });
});
