import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    /** Не тянуть реальный LLM из `.env` разработчика (neurohub/openai) — интеграционные тесты детерминированы на mock. */
    env: { LLM_PROVIDER: 'mock' },
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    server: {
      deps: {
        // next-auth imports `next/server` without `.js`; inlining lets Vite apply our alias (see nextauthjs/next-auth#12280).
        inline: ['next-auth'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // next-auth resolves `next/server` without extension; Vitest/Node needs the explicit file for E2E imports of app routes.
      'next/server': path.resolve(__dirname, './node_modules/next/server.js'),
    },
  },
});
