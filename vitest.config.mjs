import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.{mjs,ts,tsx}', 'admin-app/src/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 30000,
  },
});
