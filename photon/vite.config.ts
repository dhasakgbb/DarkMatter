import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build target: a single self-contained dist/index.html with everything inlined.
// This keeps the deployment story identical to the legacy file: open via file://, or
// drop into Capacitor for the iOS path. No network requests after first load.
export default defineConfig({
  plugins: [viteSingleFile()],
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
});
