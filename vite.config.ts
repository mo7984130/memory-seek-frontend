import { fileURLToPath, URL } from 'node:url'

import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import svgLoader from 'vite-svg-loader'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  if (!env.VITE_API_BASE_URL || env.VITE_API_BASE_URL == "exmple_url") {
    throw new Error(
      'VITE_API_BASE_URL is not set. '
        + 'Please create a .env file (see .env.example) or set the environment variable.',
    )
  }

  return {
    plugins: [
      vue(),
      vueDevTools(),
      svgLoader(),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: ['memory-seek-api'],
    },
  }
})
