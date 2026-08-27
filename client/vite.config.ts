import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import replace from '@rollup/plugin-replace'

const BUILD_TIMESTAMP = Date.now().toString();

export default defineConfig({
  plugins: [
    // @ts-ignore
    replace({
      'https://cdn.jsdelivr.net/npm/tesseract.js-core@v': 'http://127.0.0.1:0/tesseract.js-core@v',
      preventAssignment: true,
      delimiters: ['', '']
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        cacheId: `sanchar-v${BUILD_TIMESTAMP}`,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB to cache Tesseract models
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,gz,traineddata}'],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('index.html'),
            handler: 'NetworkFirst',
            options: {
              cacheName: `sanchar-html-v${BUILD_TIMESTAMP}`,
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 24 * 60 * 60 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: `sanchar-static-v${BUILD_TIMESTAMP}`,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Sanchar AI',
        short_name: 'Sanchar',
        description: 'Travel confidently, even offline.',
        theme_color: '#00695C',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0', // Allow external connections
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  }
})
