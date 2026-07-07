import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    proxy: {
      '/analyze': backendUrl,
      '/history': backendUrl,
      '/github': backendUrl,
      '/leetcode': backendUrl,
      '/kaggle': backendUrl,
      '/dashboard': backendUrl
    }
  }
})