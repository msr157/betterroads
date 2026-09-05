import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        // Keep browser requests same-origin in development. Override this to
        // inspect the live dataset without weakening production CORS.
        '/api': {
          target: env.VITE_DEV_API_PROXY || 'http://localhost:3000',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
