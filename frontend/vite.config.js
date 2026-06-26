import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config. The dev server proxies /api to a target of your choosing.
// The default points at the frontend nginx (running in the frontend container
// or locally on port 3000), which routes /api/<service>/... to the right
// FastAPI service the same way production does. Set VITE_API_TARGET to point
// at a specific backend host instead.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});