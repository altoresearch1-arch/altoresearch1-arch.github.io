import { useEffect, useRef, useState } from 'react'
import { NIVELES } from '../lib/nivel'
import { prefiereQuieto } from '../lib/anim'

// Pantalla de transición al elegir o cambiar de nivel: tapa el re-armado de
// la interfaz y le CUENTA al usuario qué está cambiando (pasos honestos de
// NIVELES[].cargando — describen las secciones que aparecen de verdad).
// Pura CSS + timeouts: cero librerías, cero peso extra en el bundle.
// Un toque la salta. Con prefers-reduced-motion dura menos y no anima.
const MS_PASO = 380 // cada paso aparece este tiempo después del anterior
const MS_SALIDA = 300 // duración del fade de despedida (espejo de .nivel-trans.saliendo)

export default function NivelTransicion({ nivelId, onFin }) {
  const n = NIVELES.find((x) => x.id === nivelId)
  const [saliendo, setSaliendo] = useState(false)
  // onFin vive en un ref: los timeouts no deben reiniciarse si el padre re-renderiza
  const finRef = useRef(onFin)
  useEffect(() => { finRef.current = onFin })

  const quieto = prefiereQuieto()
  const msVisible = quieto ? 600 : 250 + MS_PASO * 3 + 320

  useEffect(() => {
    const tSalir = setTimeout(() => setSaliendo(true), msVisible)
    const tFin = setTimeout(() => finRef.current?.(), msVisible + MS_SALIDA)
    return () => {
      clearTimeout(tSalir)
      clearTimeout(tFin)
    }
  }, [nivelId, msVisible])

  const saltar = () => {
    if (saliendo) return
    setSaliendo(true)
    setTimeout(() => finRef.current?.(), MS_SALIDA)
  }

  if (!n) return null
  return (
    <div
      className={'nivel-trans' + (saliendo ? ' saliendo' : '')}
      style={{ '--nivel-color': n.color, '--trans-total': `${msVisible}ms` }}
      onPointerDown={saltar}
      role="status"
      aria-label={`Preparando el nivel ${n.nombre}`}
    >
      <div className="nivel-trans-inner">
        <span className="nivel-trans-icono" aria-hidden="true">{n.icono}</span>
        <div className="nivel-trans-eyebrow">Nivel {n.id} de 4</div>
        <div className="nivel-trans-nombre">{n.nombre}</div>
        <ul className="nivel-trans-pasos">
          {n.cargando.map((paso, i) => (
            <li key={i} style={{ animationDelay: `${250 + i * MS_PASO}ms` }}>
              <span className="nivel-trans-check" aria-hidden="true">✓</span>
              {paso}
            </li>
          ))}
        </ul>
        <div className="nivel-trans-barra" aria-hidden="true"><span /></div>
        <div className="nivel-trans-saltar">toca para continuar</div>
      </div>
    </div>
  )
}
