import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      // Gated to prevent caching issues on localhost:5173 during normal dev.
      // Set PWA_DEV=true to test SW in dev mode, or test via 'npm run build && npm run preview'.
      devOptions: {
        enabled: process.env.PWA_DEV === 'true'
      },
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'masked-icon.svg',
        'pwa-64x64.png',
        'pwa-192x192.png',
        'pwa-192x192-maskable.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
        'screenshots/screenshot-narrow.png',
        'screenshots/screenshot-wide.png'
      ],
      manifest: {
        id: 'fluent-tindahan-pos',
        name: 'Fluent Tindahan - Sari-Sari & GCash POS',
        short_name: 'Fluent Tindahan',
        description: 'Offline-First PWA POS designed for Philippine sari-sari stores, GCash agents, and small retailers.',
        theme_color: '#0f7b51',
        background_color: '#f8faf9',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'en-PH',
        dir: 'ltr',
        categories: ['business', 'finance', 'productivity', 'utilities'],
        prefer_related_applications: false,
        icons: [
          {
            src: '/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'POS Cash Register',
            short_name: 'POS',
            description: 'Open POS counter to ring up items and sales',
            url: '/?tab=pos',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'GCash Cash-In / Cash-Out',
            short_name: 'GCash',
            description: 'Record GCash agent cash transactions and fees',
            url: '/?tab=gcash',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Utang Debtors Ledger',
            short_name: 'Utang',
            description: 'Check customer balances and record debt payments',
            url: '/?tab=utang',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Product Inventory',
            short_name: 'Inventory',
            description: 'Manage sari-sari store stock catalog',
            url: '/?tab=inventory',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          }
        ],
        screenshots: [
          {
            src: '/screenshots/screenshot-narrow.png',
            sizes: '540x960',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Fluent Tindahan Mobile POS Dashboard'
          },
          {
            src: '/screenshots/screenshot-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Fluent Tindahan Desktop Cash Register & POS'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,csv,json,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
