import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * End-to-end config, separate from the unit suite on purpose.
 *
 * The journey boots a real Postgres and a real Next server, so it costs minutes
 * rather than the unit suite's second. Keeping it out of `npm test` protects
 * the inner loop — but it means CI has to run BOTH, or this becomes exactly the
 * unrun safety net it was written to replace.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    // One server, one database, one journey: the steps are deliberately
    // sequential and share state, so they must not be parallelised.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
