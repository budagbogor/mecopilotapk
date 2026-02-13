import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
      },
    },
  },
  define: {
    // Polyfill process.env to prevent "process is not defined" error in browser.
    // This allows `process.env.API_KEY` to resolve to undefined (and thus fallback to manual input) 
    // unless you explicitly configure it in Vercel Environment Variables as VITE_API_KEY and map it here,
    // but for this app's manual key feature, an empty object is sufficient stability.
    'process.env': {}
  }
})