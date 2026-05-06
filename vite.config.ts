import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Relative base so the produced `dist/` works on any static host
  // (root, sub-path, GitHub Pages, file://, …) without reconfiguration.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the heavy third-party bundles so an unchanged
        // `three`/`tweakpane` survives across deploys in the browser cache.
        manualChunks: {
          three: ['three'],
          tweakpane: ['tweakpane'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
