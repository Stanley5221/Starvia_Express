import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const dir = path.dirname(fileURLToPath(import.meta.url))
const sharedDir = path.resolve(dir, '../../shared')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dir, '')
  return {
  plugins: [react()],
  define: {
    'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
    'process.env.VITE_SOCKET_URL': JSON.stringify(env.VITE_SOCKET_URL || ''),
  },
  resolve: {
    alias: {
      '@shared': sharedDir,
      'socket.io-client': path.resolve(dir, 'node_modules/socket.io-client'),
      'axios': path.resolve(dir, 'node_modules/axios'),
    },
  },
  optimizeDeps: {
    include: ['socket.io-client', 'axios'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
    fs: { allow: ['../..', sharedDir] },
  },
}})
