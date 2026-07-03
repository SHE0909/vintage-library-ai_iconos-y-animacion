import { defineConfig } from 'vite';

export default defineConfig({
  base: '/vintage-library-ai_iconos-y-animacion/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext'
  }
});