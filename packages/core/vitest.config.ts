import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // vitest 4 no longer excludes dist/ by default; without this a stale
    // local build gets collected as a duplicate compiled test suite.
    include: ['src/**/*.test.ts'],
  },
});
