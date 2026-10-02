import { expect, it } from 'vitest';

import { verifyDiscovery } from './check-test-discovery';

it('fails a zero-test discovery instead of accepting a silent green', () => {
  expect(() => verifyDiscovery([])).toThrow('Required contract suites missing');
});
it('fails a nonempty discovery missing required suites', () => {
  expect(() => verifyDiscovery([{ file: '/repo/unrelated.test.ts' }], '/repo')).toThrow(
    'tests/contracts/architecture/layer-boundary-contract.test.ts',
  );
});
it('accepts the complete mandatory suite set', () => {
  const files = [
    'tests/contracts/architecture/layer-boundary-contract.test.ts',
    'tests/contracts/architecture/clean-code-contract.test.ts',
    'tests/contracts/deployment/deployment-contract.test.ts',
    'app/api/operational-endpoints-contract.test.ts',
  ];
  expect(
    verifyDiscovery(
      files.map((file) => ({ file: `/repo/${file}` })),
      '/repo',
    ),
  ).toEqual({ tests: 4, files: 4 });
});
