import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// Mantener la app SIEMPRE al día. Antes, la PWA quedaba "una recarga atrás": el
// Service Worker mostraba la versión guardada y recién actualizaba en la 2ª carga.
// Ahora revisa si hay versión nueva (datos frescos del robot) al cargar, al volver
// a la pestaña y cada 5 min; en modo autoUpdate la aplica y recarga sola.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (!r) return
    const revisar = () => { r.update().catch(() => {}) }
    revisar()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') revisar()
    })
    setInterval(revisar, 5 * 60 * 1000)
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
