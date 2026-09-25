import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Build identity. The page compares it with build.json on the server to notice
// a newer dashboard build and offer a reload (a single-page app otherwise keeps
// running the bundle it loaded until someone refreshes).
const buildId = `${pkg.version}+${Date.now().toString(36)}`
function buildStamp(): Plugin {
  return {
    name: 'dcs-build-stamp',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ version: pkg.version, build: buildId }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), buildStamp()],
  root: '.',
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Proxy /api to the DCS API server (mirrors Docker nginx behavior)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9876',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
