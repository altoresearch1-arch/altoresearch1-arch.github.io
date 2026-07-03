import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base relativa para que funcione hospedado en GitHub Pages / Netlify / subcarpeta
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // PWA: instalable en el celular (ícono en pantalla) y funciona offline con
    // los últimos datos descargados. registerType autoUpdate = cuando el robot
    // diario publique datos nuevos, la app se actualiza sola al abrirla.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-alto.jpg', 'iconos/apple-touch-icon.png'],
      manifest: {
        name: 'ALTO Research — BVL para estudiar',
        short_name: 'ALTO',
        description:
          'Descubre empresas de la Bolsa de Valores de Lima para estudiar según tu perfil. Educativo — no es recomendación de inversión.',
        lang: 'es',
        start_url: './',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: 'iconos/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'iconos/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'iconos/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // la app es estática: todo (HTML, JS, CSS, JSON de datos, logo) se
        // precachea y queda disponible offline
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest}'],
      },
    }),
  ],
})
