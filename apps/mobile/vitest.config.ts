import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    alias: {
      'react-native': path.resolve(__dirname, './tests/mocks/react-native.ts'),
    },
  },
});
