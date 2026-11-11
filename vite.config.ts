import { defineConfig } from 'vite';

// GitHub Pages serves the project at /kill-rush/. Override with BASE_PATH if needed.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/kill-rush/',
  build: { target: 'es2020', outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 2000 },
  test: { globals: true, environment: 'node' },
});
