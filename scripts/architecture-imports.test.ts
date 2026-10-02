import { describe, expect, it } from 'vitest';

import { forbiddenReachability, importsOf } from './architecture-imports';

describe('resolved runtime boundary analysis', () => {
  it('recognizes static, re-export, dynamic and require edges while distinguishing erased types', () => {
    expect(
      importsOf(
        `import type { A } from '@/db'; import { type B } from './types'; export * from './barrel'; const x = import('../server'); const y = require('node:fs'); // import 'ignored'`,
      ),
    ).toEqual([
      { specifier: '@/db', typeOnly: true },
      { specifier: './types', typeOnly: true },
      { specifier: './barrel', typeOnly: false },
      { specifier: '../server', typeOnly: false },
      { specifier: 'node:fs', typeOnly: false },
    ]);
  });
  it('follows barrels and cycles to a forbidden server boundary', () => {
    const graph = new Map([
      ['client', ['barrel']],
      ['barrel', ['client', 'db/index.ts']],
    ]);
    expect(forbiddenReachability(graph, 'client', (path) => path.startsWith('db/'))).toEqual([
      'client',
      'barrel',
      'db/index.ts',
    ]);
    expect(
      forbiddenReachability(new Map([['client', ['visual']]]), 'client', (path) =>
        path.startsWith('db/'),
      ),
    ).toBeNull();
  });
});
