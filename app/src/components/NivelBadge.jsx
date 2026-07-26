import { useEffect, useRef, useState } from 'react'
import { NIVELES, PALETA, colorNivel, useTinte, esTinteDeFabrica, guardarTinte } from '../lib/nivel'

// Botón de nivel en la barra superior. v2 (15-jul): ahora los niveles son
// experiencias con identidad, así que el badge SÍ dice tu modo actual
// ("💸 Simple", "🧠 Lobo") — es más corto que "Niveles" y refuerza en qué
// experiencia estás. El menú muestra las 4 con su detalle y marca la activa.
// v3 (25-jul): abajo del todo, la 🎨 PALETA. Tiñe el nivel en el que estás
// parado —no los cuatro— y por eso el título lo nombra: cambiar de nivel en
// este mismo menú cambia también qué color estás editando. Cada nivel se
// acuerda del suyo, así que ir y volver no te borra la elección.
export default function NivelBadge({ nivel, onCambiar }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const actual = NIVELES.find((n) => n.id === nivel)
  const tinte = useTinte(nivel)
  const deFabrica = esTinteDeFabrica(nivel)

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
        style={{ '--nivel-color': tinte.color }}
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
              style={{ '--nivel-color': colorNivel(n.id) }}
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

          {/* 🎨 La paleta. El menú NO se cierra al elegir: el color se ve al
              instante detrás y probar tres seguidos tiene que costar tres
              toques, no seis. */}
          <div className="nivel-badge-sep" aria-hidden="true" />
          <div className="nivel-badge-menu-tit paleta-tit">
            🎨 Color de «{actual.corto}»
            {!deFabrica && (
              <button
                className="paleta-reset"
                onClick={() => guardarTinte(nivel, null)}
                title="Volver al color de fábrica de este nivel"
              >
                restablecer
              </button>
            )}
          </div>
          <div className="paleta" role="group" aria-label={`Color del nivel ${actual.corto}`}>
            {PALETA.map((p) => (
              <button
                key={p.id}
                className={'paleta-tono' + (p.id === tinte.id ? ' activo' : '')}
                style={{ '--tono': p.color }}
                title={p.nombre}
                aria-label={p.nombre}
                aria-pressed={p.id === tinte.id}
                onClick={() => guardarTinte(nivel, p.id)}
              >
                <span className="paleta-punto" aria-hidden="true" />
                <span className="paleta-nombre">{p.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
