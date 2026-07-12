import { useEffect, useRef, useState } from 'react'
import { NIVELES } from '../lib/nivel'

// Botón siempre visible en la barra superior — NO dice en qué nivel estás
// (para no repetir lo obvio), dice "Niveles" y resalta más que el resto del
// menú para invitar a tocarlo. Al abrirlo, ahí sí se ve cuál está activo.
export default function NivelBadge({ nivel, onCambiar }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const actual = NIVELES.find((n) => n.id === nivel)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('pointerdown', cerrar)
    return () => document.removeEventListener('pointerdown', cerrar)
  }, [abierto])

  if (!actual) return null

  return (
    <div className="nivel-badge-wrap" ref={ref}>
      <button
        className="nivel-badge"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        title="Cambiar tu nivel"
      >
        🎚️ <span className="nivel-badge-nombre">Niveles</span>
        <span className="nivel-badge-flecha">{abierto ? '▲' : '▾'}</span>
      </button>
      {abierto && (
        <div className="nivel-badge-menu">
          {NIVELES.map((n) => (
            <button
              key={n.id}
              className={'nivel-badge-opcion' + (n.id === nivel ? ' activo' : '')}
              onClick={() => {
                onCambiar(n.id)
                setAbierto(false)
              }}
            >
              {n.icono} {n.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
