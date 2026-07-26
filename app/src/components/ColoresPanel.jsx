import { useEffect, useState } from 'react'
import { NIVELES, PALETA, tinteNivel, esTinteDeFabrica, guardarTinte, leerNivel } from '../lib/nivel'

// ─────────────────────────────────────────────────────────────────────────
// 🎨 EL PANEL DE COLORES (pedido de Jair 25-jul: «no hay el selector a color»)
//
// La primera versión de la paleta vivía SOLO al pie del menú del badge de
// nivel. Estaba, funcionaba… y no existía: para llegar había que abrir un
// desplegable que la gente abre para cambiar de nivel, no para pintar. Una
// función escondida detrás de un gesto que nadie hace por ese motivo es una
// función que no está.
//
// Así que aquí está a la vista, desde el ☰, y hace lo que dice el pedido al
// pie de la letra: los CUATRO niveles, cada uno con sus siete colores. El del
// nivel en el que estás parado se aplica al instante (lo ves detrás del
// panel); los otros esperan a que entres a ese nivel.
// ─────────────────────────────────────────────────────────────────────────
export default function ColoresPanel({ onCerrar }) {
  const activo = leerNivel()
  // Redibuja el panel cuando cambia cualquier tinte (los puntos marcados, el
  // "restablecer"). Un contador basta: los colores se leen de lib/nivel.
  const [, refrescar] = useState(0)
  useEffect(() => {
    const al = () => refrescar((v) => v + 1)
    window.addEventListener('alto-tinte-cambio', al)
    const porTecla = (e) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', porTecla)
    return () => {
      window.removeEventListener('alto-tinte-cambio', al)
      document.removeEventListener('keydown', porTecla)
    }
  }, [onCerrar])

  const algoCambiado = NIVELES.some((n) => !esTinteDeFabrica(n.id))

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-colores" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Colores">
        <button className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>

        <div className="colores-cab">
          <span className="colores-icono" aria-hidden="true">🎨</span>
          <h2 className="colores-titulo">Colores</h2>
        </div>
        <p className="muted colores-intro">
          Elige el color de cada nivel. El del nivel en el que estás cambia al
          toque; los otros te esperan ahí. Se guarda en tu equipo, sin cuentas.
        </p>

        {NIVELES.map((n) => {
          const t = tinteNivel(n.id)
          return (
            <div key={n.id} className={'colores-nivel' + (n.id === activo ? ' activo' : '')}>
              <div className="colores-nivel-cab">
                <span className="colores-nivel-icono" aria-hidden="true">{n.icono}</span>
                <span className="colores-nivel-nombre">{n.corto}</span>
                {n.id === activo && <span className="colores-nivel-aqui">estás aquí</span>}
                {!esTinteDeFabrica(n.id) && (
                  <button
                    className="paleta-reset colores-nivel-reset"
                    onClick={() => guardarTinte(n.id, null)}
                    title={`Volver al color de fábrica del nivel ${n.corto}`}
                  >
                    restablecer
                  </button>
                )}
              </div>
              <div className="paleta colores-paleta" role="group" aria-label={`Color del nivel ${n.corto}`}>
                {PALETA.map((p) => (
                  <button
                    key={p.id}
                    className={'paleta-tono' + (p.id === t.id ? ' activo' : '')}
                    style={{ '--tono': p.color }}
                    aria-label={`${p.nombre} para el nivel ${n.corto}`}
                    aria-pressed={p.id === t.id}
                    onClick={() => guardarTinte(n.id, p.id)}
                  >
                    <span className="paleta-punto" aria-hidden="true" />
                    <span className="paleta-nombre">{p.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <div className="colores-pie">
          {algoCambiado && (
            <button
              className="btn btn-fantasma"
              onClick={() => NIVELES.forEach((n) => guardarTinte(n.id, null))}
            >
              Volver a los de fábrica
            </button>
          )}
          <button className="btn btn-oro" onClick={onCerrar}>Listo</button>
        </div>
      </div>
    </div>
  )
}
