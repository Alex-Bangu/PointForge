import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['pointforge.razvan.dev']
  },
  build: {
    // Ensure fresh builds by including timestamp/hash in filenames
    rollupOptions: {
      output: {
        // This ensures cache busting - Vite already does this by default with content hashes
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})