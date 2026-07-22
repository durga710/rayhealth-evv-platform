// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['src/lib/secure-store.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-secure-store',
              message:
                'expo-secure-store throws on web. Import { secureKvStore } from src/lib/secure-store instead; it falls back to localStorage on web.',
            },
          ],
        },
      ],
    },
  },
]);
