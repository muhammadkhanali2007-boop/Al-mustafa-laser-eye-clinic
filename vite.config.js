import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
