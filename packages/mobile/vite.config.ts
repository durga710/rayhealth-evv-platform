import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Dev-only CORS bypass: forward `/api/*` to the upstream RayHealth
      // backend so the browser sees same-origin requests. Native Capacitor
      // shells don't go through this — they hit VITE_PARENT_API_URL directly
      // and bypass browser CORS. Override the upstream via VITE_API_PROXY_TARGET
      // when pointing at a local backend on a non-standard host.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'https://rayhealthevv.com',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
