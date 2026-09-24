import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Data-layer tests: run in Node against the Firebase Emulator Suite (`npm run test:emulator`).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/emulator/**/*.test.ts'],
      testTimeout: 20_000,
      hookTimeout: 30_000,
      fileParallelism: false,
    },
  }),
);
