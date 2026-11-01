import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages serves the app from /<repo-name>/. Override with BASE_PATH if hosting elsewhere.
const base = process.env.BASE_PATH ?? '/Movement-427/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' so a new version never reloads the page mid-set; the user taps "Reload".
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'mōv',
        short_name: 'mōv',
        description: 'Plan, log, and understand how you move.',
        lang: 'en-US',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        background_color: '#101110',
        theme_color: '#101110',
        // iOS 26 "Open as Web App" takes its home-screen icon from here, not from
        // <link rel="apple-touch-icon">. Keep entries plain: explicit purpose, no query strings.
        icons: [
          { src: 'icons/mov-v3-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: 'icons/mov-v3-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/mov-v3-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/mov-v3-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: 'index.html',
        // Never answer a file request (icons, manifest, images) with the app's HTML shell —
        // iOS fetches the home-screen icon itself and needs the real image back.
        navigateFallbackDenylist: [/\.[a-z0-9]+$/i, /\?v=/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
