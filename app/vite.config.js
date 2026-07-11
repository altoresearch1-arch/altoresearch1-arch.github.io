import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Momento del build en hora de Perú (America/Lima, UTC-5 todo el año). El robot
// solo reconstruye/despliega cuando los datos REALMENTE cambiaron, así que este
// sello ≈ "última vez que el robot trajo datos nuevos". Formato ISO local
// "YYYY-MM-DD HH:mm:ss" gracias al locale sueco (sv-SE).
const HORA_BUILD = new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' })

// base relativa para que funcione hospedado en GitHub Pages / Netlify / subcarpeta
export default defineConfig({
  base: './',
  define: {
    __BUILD_TIME__: JSON.stringify(HORA_BUILD),
  },
  build: {
    rollupOptions: {
      output: {
        // Los DATOS van en trozos propios, separados del código. Motivo (10-jul):
        // todo iba en UN index.js de ~2.9 MB que CRECE con cada actualización
        // diaria del robot — al cruzar los 4 MiB (tope POR ARCHIVO del precache)
        // el service worker lo excluiría en silencio y la PWA se rompería.
        // Partido así: ningún archivo se acerca al tope, y el usuario que
        // vuelve solo re-descarga el trozo que cambió ese día (no todo).
        manualChunks(id) {
          if (id.includes('src/data/historicos.json')) return 'datos-historicos'
          if (id.includes('src/data/lecturas.json')) return 'datos-lecturas'
          if (id.includes('src/data/hechos.json')) return 'datos-hechos'
          if (id.includes('src/data/')) return 'datos'
        },
      },
    },
  },
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
        // el bundle pasó los 2 MiB (default de workbox) al sumar lecturas.json
        // (las lecturas de hechos del robot, 09-jul); 4 MiB da aire de sobra
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
