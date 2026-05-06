import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: false,
  },
});
