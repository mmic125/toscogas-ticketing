import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // In produzione Hetzner base = '/'; in sviluppo locale con GitHub Pages era '/toscogas-ticketing/'
  const base = env.VITE_BASE_PATH || (mode === 'production' ? '/' : '/toscogas-ticketing/')

  return {
    plugins: [react()],
    base,
    server: {
      proxy: {
        '/api':  env.VITE_API_URL || 'http://localhost:3000',
        '/auth': env.VITE_API_URL || 'http://localhost:3000',
      },
    },
  }
})