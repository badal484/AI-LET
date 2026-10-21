import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/socialShareFlow.test.ts'],
    alias: {
      'react-native': path.resolve(__dirname, './tests/mocks/react-native.ts'),
    },
  },
});
