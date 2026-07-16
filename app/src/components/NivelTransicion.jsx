import { useEffect, useMemo, useRef, useState } from 'react'
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

  // 🎇 El ELEMENTO del nivel invade la transición, estilo Destiny:
  // 🧵 hebras que ondulan al subir · 🔥 brasas rápidas que titilan ·
  // ❄️ cristales que caen girando. El nivel 4 👑 va LIMPIO, sin motas
  // (pedido de Jair 16-jul: fuera destellos de oro). Puros spans +
  // CSS (keyframes por elemento en styles.css); se regeneran por transición
  // y no existen si el usuario pidió menos movimiento.
  const motas = useMemo(() => {
    if (quieto || nivelId === 4) return []
    const cuantas = nivelId === 2 ? 36 : nivelId === 3 ? 24 : 30
    return Array.from({ length: cuantas }, (_, i) => {
      const talla = 2.5 + Math.random() * 4.5
      // ritmo propio: el fuego es rápido, el hielo cae lento
      const dur = nivelId === 2
        ? 1.0 + Math.random() * 1.0
        : nivelId === 3
          ? 2.2 + Math.random() * 1.4
          : 1.5 + Math.random() * 1.2
      return {
        id: i,
        left: Math.random() * 100,
        dur,
        espera: Math.random() * 1.1,
        alfa: 0.25 + Math.random() * 0.5,
        rot: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 16), // vaivén de la hebra
        // forma según el elemento: hebra fina y larga / brasa y cristal redondos
        estilo: nivelId === 1
          ? { width: '2px', height: `${16 + Math.random() * 44}px` }
          : { width: `${talla}px`, height: `${talla}px` },
      }
    })
  }, [nivelId, quieto])

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
      {motas.length > 0 && (
        <div className={`nivel-trans-motas elemento-${n.id}`} aria-hidden="true">
          {motas.map((m) => (
            <span
              key={m.id}
              style={{
                left: `${m.left}%`,
                animationDuration: `${m.dur}s`,
                animationDelay: `${m.espera}s`,
                '--mota-alfa': m.alfa,
                '--mota-rot': `${m.rot}deg`,
                ...m.estilo,
              }}
            />
          ))}
        </div>
      )}
      <div className="nivel-trans-inner">
        {/* el ELEMENTO manda (estilo Destiny): 🧵🔥❄️👑 grande, el icono
            del nivel queda chiquito en el eyebrow */}
        <span className="nivel-trans-icono" aria-hidden="true">{n.elemento}</span>
        <div className="nivel-trans-eyebrow">{n.icono} Nivel {n.id} de 4</div>
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
