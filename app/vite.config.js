import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Crucial: exposes the server to your phone via your local IP
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Your FastAPI location
        changeOrigin: true,
        secure: false,
      }
    }
  }
})