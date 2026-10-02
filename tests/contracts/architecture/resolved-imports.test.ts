import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';

import ts from 'typescript';
import { expect, it } from 'vitest';

import { forbiddenReachability, resolvedRuntimeGraph } from '@/scripts/architecture-imports';

it('prevents client entry points reaching server, data, persistence or Node implementations', () => {
  const root = process.cwd();
  const files = ts.sys
    .readDirectory(
      root,
      ['.ts', '.tsx'],
      ['node_modules', '.next', '**/*.test.ts', '**/*.test.tsx', 'tests', 'scripts'],
      [
        'app/**/*',
        'features/**/*',
        'shared/**/*',
        'lib/**/*',
        'db/**/*',
        'i18n/**/*',
        'auth.ts',
        'proxy.ts',
      ],
    )
    .map((file) => file.slice(root.length + 1));
  const graph = resolvedRuntimeGraph(root, files);
  const violations: string[][] = [];
  for (const file of files) {
    if (!/^\s*['"]use client['"]/.test(readFileSync(resolve(root, file), 'utf8'))) continue;
    const violation = forbiddenReachability(
      graph,
      file,
      (path) =>
        /^(db\/|lib\/server\/|lib\/data\/|node:)/.test(path) ||
        builtinModules.includes(path) ||
        path === 'server-only',
    );
    if (violation) violations.push(violation);
  }
  expect(violations).toEqual([]);
});
