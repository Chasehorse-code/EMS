import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@chasehorse/design-tokens/web.css': fileURLToPath(new URL('./packages/design-tokens/src/web.css', import.meta.url)),
      '@chasehorse/design-tokens': fileURLToPath(new URL('./packages/design-tokens', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Increase the chunk warning limit for the large SPA
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          maps: ['leaflet'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
