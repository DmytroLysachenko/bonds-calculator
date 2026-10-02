import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['tests/contracts/architecture/*.test.ts'],
    exclude: [],
    passWithNoTests: false,
  },
});
