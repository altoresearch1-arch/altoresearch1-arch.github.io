import { useEffect, useRef, useState } from 'react'
import { NIVELES } from '../lib/nivel'

// Botón de nivel en la barra superior. v2 (15-jul): ahora los niveles son
// experiencias con identidad, así que el badge SÍ dice tu modo actual
// ("💸 Simple", "🧠 Lobo") — es más corto que "Niveles" y refuerza en qué
// experiencia estás. El menú muestra las 4 con su detalle y marca la activa.
export default function NivelBadge({ nivel, onCambiar }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const actual = NIVELES.find((n) => n.id === nivel)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    const porTecla = (e) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', cerrar)
    document.addEventListener('keydown', porTecla)
    return () => {
      document.removeEventListener('pointerdown', cerrar)
      document.removeEventListener('keydown', porTecla)
    }
  }, [abierto])

  if (!actual) return null

  return (
    <div className="nivel-badge-wrap" ref={ref}>
      <button
        className="nivel-badge"
        style={{ '--nivel-color': actual.color }}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        title="Cambiar tu nivel"
      >
        <span aria-hidden="true">{actual.icono}</span>
        <span className="nivel-badge-nombre">{actual.corto}</span>
        <span className="nivel-badge-flecha" aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div className="nivel-badge-menu">
          <div className="nivel-badge-menu-tit">Tu experiencia</div>
          {NIVELES.map((n) => (
            <button
              key={n.id}
              className={'nivel-badge-opcion' + (n.id === nivel ? ' activo' : '')}
              style={{ '--nivel-color': n.color }}
              onClick={() => {
                onCambiar(n.id)
                setAbierto(false)
              }}
            >
              <span className="nivel-badge-opcion-icono" aria-hidden="true">{n.icono}</span>
              <span className="nivel-badge-opcion-textos">
                <span className="nivel-badge-opcion-nombre">{n.nombre}</span>
                <span className="nivel-badge-opcion-detalle">{n.detalle}</span>
              </span>
              {n.id === nivel && <span className="nivel-badge-opcion-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
