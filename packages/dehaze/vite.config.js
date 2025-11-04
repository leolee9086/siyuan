import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: './demo',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@demo': resolve(__dirname, './demo')
    }
  },
  server: {
    port: 3000,
    open: true
  }
}) 