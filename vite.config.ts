/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// App desktop: o motor da voz (onnxruntime, usado pelo Whisper no computador) vai junto em dist-app/ort, nada de CDN.
const motorDaVoz = () => ({
  name: 'atlas-motor-da-voz',
  closeBundle() {
    const de = join('node_modules', 'onnxruntime-web', 'dist')
    const para = join('dist-app', 'ort')
    mkdirSync(para, { recursive: true })
    for (const f of readdirSync(de)) if (/^ort-wasm-simd-threaded(\.jsep)?\.(wasm|mjs)$/.test(f)) copyFileSync(join(de, f), join(para, f))
  },
})

// Build do app desktop (`vite build --mode app`): caminhos relativos (file://), sem PWA, pasta própria.
export default defineConfig(({ mode }) => {
  const app = mode === 'app'
  return {
  base: app ? './' : '/',
  build: app ? { outDir: 'dist-app' } : undefined,
  worker: { format: 'es' as const },
  plugins: [
    react(),
    ...(app ? [motorDaVoz()] : []),
    ...(app ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      // A página (index.html) NUNCA é guardada nem entregue pelo service worker: toda navegação busca a versão
      // publicada. Guardada, ela fazia quem já tinha visitado o site abrir /instalar e ver a página de vendas antiga.
      // sw-versao-antiga.js recarrega uma vez quem ainda está com a página antiga guardada.
      workbox: {
        globPatterns: ['**/*.{js,css}'],
        globIgnores: ['sw-versao-antiga.js', 'sw-avisos.js'],
        navigateFallback: null,
        importScripts: ['sw-versao-antiga.js', 'sw-avisos.js'],
      },
      manifest: {
        name: 'Atlas',
        short_name: 'Atlas',
        lang: 'pt-BR',
        description: 'O Atlas constrói o seu sistema enquanto você cuida do seu negócio.',
        theme_color: '#141619',
        background_color: '#141619',
        display: 'standalone',
        // M33: instalado na tela do celular, abre o app do dono (as obras), não a página de vendas.
        start_url: '/app',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    })]),
  ],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
  }
})
