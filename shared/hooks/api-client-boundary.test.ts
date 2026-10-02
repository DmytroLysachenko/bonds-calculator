import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('shared hook API client boundary', () => {
  it('keeps generic chart data reads on the shared API client', () => {
    const source = read('shared/hooks/useChartData.ts');

    expect(source).toContain("from '@/shared/lib/api-client'");
    expect(source).toContain('apiGet<T>');
    expect(source).not.toContain('fetch(');
  });

  it('keeps bond definition reads on the shared API client', () => {
    const source = read('shared/hooks/useBondDefinitions.ts');

    expect(source).toContain("from '@/shared/lib/api-client'");
    expect(source).toContain("'/api/bond-definitions'");
    expect(source).toContain('apiGet<Record<BondType, BondDefinition>>');
    expect(source).not.toContain('fetch(');
  });
});
