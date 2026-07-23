import { useEffect, useRef, useState } from 'react'

// ¿El usuario pidió menos movimiento? (accesibilidad) — se respeta siempre.
export function prefiereQuieto() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

// Número que "cuenta hacia arriba" hasta su valor real (suave, ~700 ms).
// Uso: <CountUp valor={30.31} decimales={2} />
export function CountUp({ valor, decimales = 2, duracion = 700 }) {
  const [mostrado, setMostrado] = useState(prefiereQuieto() ? valor : 0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (valor == null) return
    if (prefiereQuieto()) {
      setMostrado(valor)
      return
    }
    // ⚠️ Pestaña en segundo plano: el navegador CONGELA requestAnimationFrame.
    // Si alguien abre la ficha en una pestaña nueva (o bloquea el celular a
    // media carga), la animación nunca arranca y el precio se queda clavado en
    // "US$ 0.0" hasta que recargue. Visto en el deploy del 23-jul con BVN, que
    // vale US$ 31.9. Por eso: si la pestaña está oculta se pone el valor final
    // de una y no se anima nada — nunca un cero que no es cero.
    if (typeof document !== 'undefined' && document.hidden) {
      setMostrado(valor)
      return
    }
    const inicio = performance.now()
    const desde = 0
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion)
      const suave = 1 - Math.pow(1 - t, 3) // ease-out cúbico
      setMostrado(desde + (valor - desde) * suave)
      if (t < 1) rafRef.current = requestAnimationFrame(paso)
    }
    rafRef.current = requestAnimationFrame(paso)
    // Red de seguridad: si por lo que sea el rAF se detiene a medio camino
    // (la pestaña se oculta justo después de montar), a los duracion+300 ms se
    // escribe el valor real igual.
    const red = setTimeout(() => setMostrado(valor), duracion + 300)
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(red) }
  }, [valor, duracion])

  if (valor == null) return null
  return <>{mostrado.toFixed(decimales)}</>
}

// Revela el contenido con un fade-up cuando entra a la pantalla (scroll).
// Uso: <Reveal><MiSeccion /></Reveal>
// Los props extra (ej. data-tour="tips") viajan al div: así el tour puede
// apuntar a una sección sin envolverla en otra capa (sesión 2 del plan).
export function Reveal({ children, retraso = 0, ...resto }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(prefiereQuieto())

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0].isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])

  return (
    <div
      ref={ref}
      className={'reveal' + (visible ? ' reveal-visto' : '')}
      style={retraso ? { transitionDelay: `${retraso}ms` } : undefined}
      {...resto}
    >
      {children}
    </div>
  )
}
