import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// BASE_PATH (e.g. '/SISP/') is set by the GitHub Pages workflow; the default './'
// keeps the build portable (GitHub Pages subpath, any subfolder, or opening dist/ statically).
export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1200 },
})
