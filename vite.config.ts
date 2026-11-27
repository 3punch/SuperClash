import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The app is served from a proxied preview host inside the sandbox, so the
// dev/preview servers must accept that host name rather than only localhost.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
  },
});
