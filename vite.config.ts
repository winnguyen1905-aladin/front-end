import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: true, // Enable source maps
  },
  resolve: {
    alias: {
      '@socket': '/src/socket',
      '@types': '/src/types',
      '@utils': '/src/utils',
      '@components': '/src/components',
      '@pages': '/src/page',
      '@routes': '/src/routes',
      '@context': '/src/context',
      '@hooks': '/src/hooks'
    }
  }
})
