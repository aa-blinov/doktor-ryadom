import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'prompt', manifest: { name: 'Рядом', short_name: 'Рядом', lang: 'ru', id:'/', scope:'/', description:'Дневник состояния, рекомендации врача и короткие практики.', start_url: '/', display: 'standalone', background_color: '#f5f6f2', theme_color: '#326950', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }, workbox: { importScripts:['/push-events.js'],navigateFallbackDenylist: [/^\/api\//], globPatterns: ['**/*.{js,css,html,woff2,png,svg,ttf,json,webp}'], maximumFileSizeToCacheInBytes: 3500000 } })],
  build: { outDir: 'dist/client', emptyOutDir: true, rollupOptions: { output: { manualChunks: {
    // Vendor split by library so a release only invalidates the chunks that actually changed.
    react: ['react', 'react-dom', 'react-dom/client'],
    mantine: ['@mantine/core', '@mantine/hooks'],
    zod: ['zod'],
    icons: ['@tabler/icons-react']
  } } } },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
