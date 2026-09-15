import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/* FE-15 release hardening (deployment-architecture.md §3, DL2):
 *  - `VITE_API_BASE_URL` is validated at build time. The backend is a GAS web app
 *    with an opaque URL, so a missing value must fail loudly — `fetch(undefined)`
 *    silently resolves against the current origin and POSTs to the SPA's own
 *    index.html, which surfaces as an unreadable JSON parse error at runtime.
 *  - React is split into a long-lived vendor chunk so app code can be redeployed
 *    without invalidating it in the browser cache.
 *  - an explicit `target` keeps the emitted syntax stable across Vite upgrades.
 *  - `sourcemap: false` keeps source out of the published bundle (SRS §24). */
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBaseUrl = (env.VITE_API_BASE_URL ?? '').trim();

  if (command === 'build' && apiBaseUrl === '') {
    throw new Error(
      [
        'VITE_API_BASE_URL is not set.',
        '',
        'The production build refuses to run without it: the API endpoint is baked',
        'into the bundle at build time, and an empty value makes every request POST',
        'to the app\'s own origin instead of the Google Apps Script backend.',
        '',
        'Fix: copy frontend/.env.example to frontend/.env and set VITE_API_BASE_URL,',
        'or export it in the environment running the build.',
      ].join('\n'),
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: 'es2020',
      cssCodeSplit: true,
      reportCompressedSize: true,
      /* Warn above 500 kB (the pre-FE-15 index chunk was ~196 kB). */
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
    server: {
      port: 3000,
    },
  };
});
