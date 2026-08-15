import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

// package.json is the single source of the version. The header badge used to
// carry its own hardcoded copy, which drifted three minor versions away from
// the real one. Read through createRequire rather than a JSON import so the
// config needs no import-attribute syntax.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    // Tauri's devUrl points at this exact port. Without strictPort, Vite would
    // quietly move to 3001 when 3000 is taken and the desktop window would open
    // on nothing.
    port: 3000,
    strictPort: true,
  },
  optimizeDeps: {
    // Vite scans `**/*.html` for entry points by default. This project has
    // hundreds of other HTML files once anything has been built — Tauri's
    // codegen assets under `src-tauri/target/`, Gradle's reports under
    // `gen/android/build/` — and the scan fails on them, which makes it skip
    // dependency pre-bundling altogether and the dev server start slowly and
    // noisily. There is exactly one entry point, so say so.
    entries: ['index.html'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
});
