import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup-logtape.ts'],
    hookTimeout: 30_000,
    testTimeout: 15_000,
    include: ['tests/integration/**/*.test.ts'],
  },
});
