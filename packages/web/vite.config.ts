import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
      // Trailing slash so the prefix only matches `@/...`, not scoped
      // packages like `@radix-ui/*` or `@vitejs/plugin-react`.
      '@/': path.resolve(__dirname, './src') + '/',
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
      '@/': path.resolve(__dirname, './src') + '/',
    },
  },
});
