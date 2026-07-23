import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    allowedHosts: true,
    // Clickjacking/MIME-sniffing headers — set here (not just via <meta> in index.html)
    // because frame-ancestors and X-Frame-Options only take effect as real HTTP headers.
    // Whatever serves frontend/dist in production should set the same headers there.
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
