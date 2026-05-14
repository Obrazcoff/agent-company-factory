import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// eslint-config-next/core-web-vitals ships a flat config array in v16
const nextConfig = require('eslint-config-next/core-web-vitals');
const prettierConfig = require('eslint-config-prettier');

const config = [
  ...nextConfig,
  prettierConfig,
  {
    rules: {
      'no-console': 'warn',
      'prefer-const': 'error',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'coverage/**', 'dist/**'],
  },
];

export default config;
