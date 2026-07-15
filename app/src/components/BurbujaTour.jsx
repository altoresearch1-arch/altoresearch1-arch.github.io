import { useState } from 'react'

// ❓ Burbuja del tour (abajo a la izquierda, espejo de la pill de apoyo):
// SIEMPRE está ahí por si quieres el tour — y la primera vez se presenta
// sola con un globito de saludo. Cerrar el saludo no la mata: queda la ❓.
// Un saludo por pantalla (inicio/ficha), recordado en localStorage.
export default function BurbujaTour({ vista, onAbrir }) {
  const clave = 'alto-tour-saludo-' + (vista === 'empresa' ? 'ficha' : 'inicio')
  const [saludo, setSaludo] = useState(() => {
    try { return !localStorage.getItem(clave) } catch { return true }
  })

  const cerrarSaludo = () => {
    setSaludo(false)
    try { localStorage.setItem(clave, '1') } catch { /* sin storage */ }
  }

  const abrir = () => {
    cerrarSaludo()
    onAbrir()
  }

  return (
    <div className="burbuja-tour-wrap">
      {saludo && (
        <div className="burbuja-tour-saludo">
          <button className="burbuja-tour-x" onClick={cerrarSaludo} aria-label="Cerrar">✕</button>
          <strong>👋 {vista === 'empresa' ? '¿Te explico esta ficha?' : '¿Primera vez por aquí?'}</strong>
          <p>Te llevo de la mano y te explico todo, pasito a pasito.</p>
          <button className="btn btn-oro burbuja-tour-si" onClick={abrir}>
            🚶 Sí, dame el tour
          </button>
        </div>
      )}
      <button
        className="burbuja-tour"
        onClick={abrir}
        aria-label="Abrir el tour guiado"
        title="Tour guiado: te explicamos esta pantalla"
      >
        ❓
      </button>
    </div>
  )
}
