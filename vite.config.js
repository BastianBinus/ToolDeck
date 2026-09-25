import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the repo under /ToolDeck/. Set BASE=/ for another host.
const base = process.env.BASE ?? '/ToolDeck/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      // A new version waits until the app is fully closed. autoUpdate would take
      // over an open app and delete the chunks its lazy tools still need.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.svg'],
      manifest: {
        name: 'ToolDeck',
        short_name: 'ToolDeck',
        description: 'Small tools that run on the device.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#141412',
        theme_color: '#141412',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // transformers.js and the onnxruntime WASM it pulls in. The models
            // themselves are cached by transformers.js in its own Cache Storage.
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn',
              cacheableResponse: { statuses: [200] },
              // Old transformers.js/onnxruntime versions age out after an upgrade.
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
});
