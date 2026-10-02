import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Server boundaries run without jsdom so accidental browser/database fallbacks surface. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.server.setup.ts'],
    include: ['lib/server/**/*.test.ts', 'app/api/**/*.test.ts'],
    exclude: ['**/*.contract.test.ts', '**/*contract.test.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './') } },
});
