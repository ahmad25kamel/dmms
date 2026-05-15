import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/dmms': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})