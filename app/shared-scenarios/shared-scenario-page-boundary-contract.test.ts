import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
}

describe('shared scenario page boundary', () => {
  it('keeps shared scenario page reads behind the server service boundary', () => {
    const page = read('app/shared-scenarios/[shareId]/page.tsx');
    const service = read('lib/server/shared-scenarios/service.ts');
    const repository = read('lib/server/shared-scenarios/repository.ts');

    expect(page).toContain("from '@/lib/server/shared-scenarios/service'");
    expect(page).toContain('getSharedPageMetadata');
    expect(page).toContain('getSharedSingleScenarioPageData');
    expect(page).not.toContain("from '@/db'");
    expect(page).not.toContain('db.query');
    expect(page).not.toContain('parseSharedSingleScenarioPayload');
    expect(page).toContain('notFound()');

    expect(page).not.toContain('scenario.description');
    expect(service).toContain('getSharedSingleScenarioPageData');
    expect(service).toContain('findSharedSingleScenarioRecord');
    expect(service).not.toContain("from '@/db'");
    expect(service).not.toContain('db.query');
    expect(service).toContain('BondInputsSchema.parse(parsed.inputs)');
    expect(repository).toContain('db.query.sharedSingleScenarios.findFirst');
  });
});
