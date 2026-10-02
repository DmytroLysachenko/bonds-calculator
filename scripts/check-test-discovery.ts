import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const required = [
  'tests/contracts/architecture/layer-boundary-contract.test.ts',
  'tests/contracts/architecture/clean-code-contract.test.ts',
  'tests/contracts/deployment/deployment-contract.test.ts',
  'app/api/operational-endpoints-contract.test.ts',
];
export function verifyDiscovery(discovered: Array<{ file: string }>, root = process.cwd()) {
  const files = new Set(discovered.map(({ file }) => file.replace(`${root}/`, '')));
  const missing = required.filter((file) => !files.has(file));
  if (!discovered.length || missing.length)
    throw new Error(`Required contract suites missing: ${missing.join(', ')}`);
  return { tests: discovered.length, files: files.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const discovered = JSON.parse(
    execFileSync(
      'pnpm',
      ['exec', 'vitest', 'list', '--config', 'vitest.contracts.config.ts', '--json'],
      { encoding: 'utf8' },
    ),
  ) as Array<{ file: string }>;
  const counts = verifyDiscovery(discovered);
  console.info(`Discovered ${counts.tests} contract tests in ${counts.files} files.`);
}
