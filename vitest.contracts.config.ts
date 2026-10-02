import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/contracts/**/*.test.ts',
      '**/*contract.test.{ts,tsx}',
      '**/*-boundary.test.{ts,tsx}',
    ],
    exclude: ['node_modules/**', '.next/**', 'tests/browser/**'],
    passWithNoTests: false,
  },
});
