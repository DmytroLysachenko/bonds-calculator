import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.server.setup.ts'],
    globals: true,
    testTimeout: 15_000,
    include: ['**/*.{test,spec}.ts', '**/*.{test,spec}.tsx'],
    exclude: [
      'node_modules/**',
      'tests/browser/**',
      '**/*.contract.test.{ts,tsx}',
      '**/*contract.test.{ts,tsx}',
      '**/*-style.test.{ts,tsx}',
      '**/*-layout.test.{ts,tsx}',
      '**/*-boundary.test.{ts,tsx}',
      'playwright-report/**',
      'test-results/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['features/bond-core/**', 'lib/server/**', 'shared/lib/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.contract.test.{ts,tsx}'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
