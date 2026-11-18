/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['monograma-fundo-escuro.png'],
      manifest: {
        name: 'Atlas',
        short_name: 'Atlas',
        lang: 'pt-BR',
        description: 'O Atlas constrói o seu sistema enquanto você cuida do seu negócio.',
        theme_color: '#141619',
        background_color: '#141619',
        display: 'standalone',
        icons: [{ src: 'monograma-fundo-escuro.png', sizes: 'any', type: 'image/png', purpose: 'any' }],
      },
    }),
  ],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
})
