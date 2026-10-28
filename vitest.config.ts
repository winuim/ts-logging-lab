import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup-logtape.ts'],
    include: ['tests/unit/**/*.test.ts'],
  },
});
