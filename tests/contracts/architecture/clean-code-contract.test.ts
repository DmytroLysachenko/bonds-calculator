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

function filesContaining(pattern: RegExp) {
  return codeFiles.filter((file) => pattern.test(sourceByFile.get(file) ?? ''));
}

const codeFiles = codeRoots.flatMap(listCodeFiles);
const sourceByFile = new Map(codeFiles.map((file) => [file, read(file)]));

describe('clean code architecture contract', () => {
  it('keeps browser fetch calls behind approved gateway and worker files', () => {
    const approvedFetchFiles = new Set([
      'shared/lib/api-client.ts',
      'shared/lib/calculation-client.ts',
      'shared/components/observability/WebVitalsReporter.tsx',
      'shared/workers/calculation.worker.ts',
    ]);
    const matches = filesContaining(/\bfetch\(/)
      .filter(
        (file) =>
          file.startsWith('app/') || file.startsWith('features/') || file.startsWith('shared/'),
      )
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => !approvedFetchFiles.has(file));

    expect(matches).toEqual([]);
  });

  it('keeps sync and provider http calls behind the sync gateway', () => {
    const approvedServerFetchFiles = new Set(['lib/sync/http-gateway.ts']);
    const matches = filesContaining(/\bfetch\(/)
      .filter((file) => file.startsWith('lib/sync/') || file.startsWith('lib/api-clients/'))
      .filter((file) => !file.endsWith('.test.ts'))
      .filter((file) => !approvedServerFetchFiles.has(file));

    expect(matches).toEqual([]);
  });

  it('keeps app api route response envelopes on shared helpers', () => {
    const allowedRawJsonRoutes = new Set([
      'app/api/health/route.ts',
      'app/api/readiness/route.ts',
      'app/api/observability/vitals/route.ts',
      'app/api/security/csp-report/route.ts',
    ]);
    const matches = filesContaining(/NextResponse\.json/)
      .filter((file) => file.startsWith('app/api/'))
      .filter((file) => !allowedRawJsonRoutes.has(file));

    expect(matches).toEqual([]);
  });

  it('keeps app api route body parsing on shared helpers', () => {
    const allowedRawBodyReaders = new Set<string>();
    const matches = filesContaining(/await req\.json\(/)
      .filter((file) => file.startsWith('app/api/'))
      .filter((file) => !allowedRawBodyReaders.has(file));

    expect(matches).toEqual([]);
  });

  it('keeps feature client logging behind the shared client logger', () => {
    const approvedClientConsoleFiles = new Set([
      'features/bond-core/utils/calculation-cache.ts',
      'shared/lib/client-logger.ts',
    ]);
    const matches = filesContaining(/console\.(error|warn|log|info)\(/)
      .filter(
        (file) =>
          file.startsWith('app/') || file.startsWith('features/') || file.startsWith('shared/'),
      )
      .filter((file) => !file.startsWith('app/api/'))
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => !approvedClientConsoleFiles.has(file));

    expect(matches).toEqual([]);
  });

  it('keeps broad lint and comment escape hatches explicit', () => {
    const approvedDisableFiles = new Set(['shared/hooks/useQuerySync.ts']);
    const disallowedMarkers = filesContaining(/TODO|FIXME|debugger|@ts-ignore/).filter(
      (file) => !file.endsWith('clean-code-contract.test.ts'),
    );
    const unapprovedLintDisables = filesContaining(/eslint-disable/).filter(
      (file) => !approvedDisableFiles.has(file),
    );

    expect(disallowedMarkers).toEqual([]);
    expect(unapprovedLintDisables).toEqual([]);
  });
});
