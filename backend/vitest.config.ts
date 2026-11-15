import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 15000,
    env: {
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
    },
  },
});
