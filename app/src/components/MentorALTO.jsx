import { useEffect, useMemo, useRef, useState } from 'react'
import {
  tarjetaMentor,
  hayTarjeta,
  dudasDe,
  SECCIONES,
  ETIQUETA_REPOSO,
  vistos,
  marcarVisto,
  alcanzables,
} from '../lib/mentor'

// ─────────────────────────────────────────────────────────────────────────
// 🎓 EL MENTOR ALTO (mejora #151, idea de Jair — la cáscara)
// Un SOLO botón flotante de aprendizaje. Antes había que ir a buscar la
// ayuda en cinco puertas distintas (tooltips, tour, guías, Atlas, checklist);
// ahora la ayuda está parada al costado, hablando de lo que el usuario está
// mirando en ese momento.
//
// Cuatro modos, los de la maqueta aprobada el 21-jul:
//   👆 ¿Qué es esto?  → enciende bordes DORADOS punteados sobre las secciones
//                       reales de la ficha y explica la que toques.
//   🤔 No entendí     → las dudas típicas de la sección donde está parado.
//   🚶 Tour           → el tour de siempre (esta pill ABSORBIÓ la ❓; regla
//                       #151: un solo flotante de aprendizaje, no tres).
//   🧠 Atlas          → la pregunta ya escrita, para seguir conversando.
//
// Anatomía barata y fiel a la casa (§31-7): los objetivos son atributos
// `data-mentor="pe|deuda|…"` sobre secciones que YA existen, el contenido
// vive en mentor.json (editable por Jair) y el progreso en localStorage.
// Cero dependencias nuevas.
// ─────────────────────────────────────────────────────────────────────────

// Saludo de la primera vez, heredado de la BurbujaTour que este botón absorbe.
const SALUDOS = {
  empresa: { clave: 'ficha', titulo: '¿Te explico esta ficha?', texto: 'Toca cualquier parte y te la explico con un ejemplo, o te llevo de la mano en un tour.' },
  inicio: { clave: 'inicio', titulo: '¿Primera vez por aquí?', texto: 'Soy tu mentor: te explico lo que estés mirando, cuando quieras.' },
  explorar: { clave: 'explorar', titulo: '¿Te explico cómo explorar?', texto: 'Cómo buscar, filtrar y batir 2 empresas en duelo — pasito a pasito.' },
  cuaderno: { clave: 'cuaderno', titulo: '¿Te muestro tu Cuaderno?', texto: 'Cargo una cartera de ejemplo y te enseño cada parte, de la mano.' },
  comparar: { clave: 'comparar', titulo: '¿Te explico el duelo?', texto: 'Cómo leer la carrera, la tabla y cuándo comparar dos empresas NO tiene sentido.' },
  resultados: { clave: 'resultados', titulo: '¿De dónde salieron estas?', texto: 'Te explico tu perfil, por qué estas empresas y qué hacer ahora.' },
}

export default function MentorALTO({ vista, nivel = 2, empresa = null, onTour, onAtlas }) {
  // null = en reposo (solo la pill) · 'panel' · 'tocar' · 'card' · 'noent'
  const [modo, setModo] = useState(null)
  const [clave, setClave] = useState(null)   // la tarjeta abierta
  const [verEjemplo, setVerEjemplo] = useState(false)
  const [seccion, setSeccion] = useState(null) // dónde está parado el usuario
  const [aprendidos, setAprendidos] = useState(vistos)

  const info = SALUDOS[vista] || SALUDOS.inicio
  const claveSaludo = 'alto-mentor-saludo-' + info.clave
  const [saludo, setSaludo] = useState(() => {
    try { return !localStorage.getItem(claveSaludo) } catch { return true }
  })
  const cerrarSaludo = () => {
    setSaludo(false)
    try { localStorage.setItem(claveSaludo, '1') } catch { /* sin storage */ }
  }

  // ── Dónde está parado: la sección visible más arriba de la pantalla.
  // Es el IntersectionObserver que el tour ya usaba, sin capas nuevas.
  // #151-6: la etiqueta cambia al ENTRAR a una sección mayor y con un freno
  // de 4 s — si cambiara con cada scroll parecería un bicho nervioso.
  // -Infinity y no 0: performance.now() vale pocos milisegundos recién cargada
  // la página, y con 0 el freno se comía el PRIMER cambio de etiqueta.
  const ultimoCambio = useRef(-Infinity)
  useEffect(() => {
    if (modo) return // con el panel abierto, la etiqueta se queda quieta
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((x) => x.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (!visible) return
        const sec = tarjetaMentor(visible.target.dataset.mentor, { nivel, empresa })?.seccion
        if (!sec) return
        const ahora = performance.now()
        setSeccion((prev) => {
          if (prev === sec) return prev
          // El primer cambio entra siempre; los siguientes, con freno.
          if (prev !== null && ahora - ultimoCambio.current < 4000) return prev
          ultimoCambio.current = ahora
          return sec
        })
      },
      { rootMargin: '-15% 0px -55% 0px' },
    )
    // Las secciones de la ficha no están todas al montar: los Reveal aparecen
    // conforme el usuario baja. Por eso se re-observa cuando el DOM cambia,
    // en vez de mirar una sola vez y quedarse con lo que había.
    const observar = () => document.querySelectorAll('[data-mentor]').forEach((o) => obs.observe(o))
    observar()
    let pendiente = null
    const mo = new MutationObserver(() => {
      clearTimeout(pendiente)
      pendiente = setTimeout(observar, 250)
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { clearTimeout(pendiente); mo.disconnect(); obs.disconnect() }
  }, [modo, nivel, empresa, vista])

  // Al cambiar de pantalla, el Mentor vuelve a reposo: su contexto ya no vale.
  useEffect(() => { setModo(null); setSeccion(null) }, [vista, empresa?.ticker])

  // ── Modo 👆 tocar: se marca el <html> y el CSS enciende los bordes de
  // TODO lo que tenga data-mentor con algo escrito para este nivel.
  useEffect(() => {
    const raiz = document.documentElement
    if (modo !== 'tocar') { raiz.removeAttribute('data-mentor-tocando'); return }
    raiz.setAttribute('data-mentor-tocando', '1')
    // No se encienden ni responden: los que no tienen tarjeta en este nivel,
    // y los que no OCUPAN espacio — un Reveal vacío (la producción minera en
    // un banco) dibujaría un borde dorado alrededor de la nada. Es el mismo
    // fix que ya se le hizo al tour el 22-jul.
    const muertos = [...document.querySelectorAll('[data-mentor]')]
      .filter((el) => !hayTarjeta(el.dataset.mentor, nivel) || !el.getClientRects().length)
    muertos.forEach((el) => el.setAttribute('data-mentor-off', '1'))

    const alTocar = (ev) => {
      const el = ev.target.closest('[data-mentor]:not([data-mentor-off])')
      if (!el) return
      ev.preventDefault()
      ev.stopPropagation()
      abrirTarjeta(el.dataset.mentor)
    }
    document.addEventListener('click', alTocar, true)
    return () => {
      document.removeEventListener('click', alTocar, true)
      raiz.removeAttribute('data-mentor-tocando')
      muertos.forEach((el) => el.removeAttribute('data-mentor-off'))
    }
  }, [modo, nivel])

  // Esc: cierra lo que esté abierto, un escalón por vez.
  useEffect(() => {
    if (!modo) return
    const al = (e) => {
      if (e.key !== 'Escape') return
      if (modo === 'card' || modo === 'noent') setModo('panel')
      else setModo(null)
    }
    window.addEventListener('keydown', al)
    return () => window.removeEventListener('keydown', al)
  }, [modo])

  const abrirTarjeta = (k) => {
    if (!hayTarjeta(k, nivel)) return // Regla #1: no se abre un panel vacío
    setClave(k)
    setVerEjemplo(false)
    setModo('card')
  }

  const tarjeta = useMemo(
    () => (clave ? tarjetaMentor(clave, { nivel, empresa }) : null),
    [clave, nivel, empresa],
  )

  const entendido = () => {
    setAprendidos(marcarVisto(clave))
    setModo(null)
  }

  const techo = useMemo(() => alcanzables(nivel).length, [nivel])
  const contados = aprendidos.filter((k) => hayTarjeta(k, nivel))
  const etiqueta = seccion ? SECCIONES[seccion]?.etiqueta ?? ETIQUETA_REPOSO : ETIQUETA_REPOSO
  const dudas = dudasDe(seccion, nivel)
  const nombreSeccion = seccion ? (SECCIONES[seccion]?.etiqueta ?? '').replace(/^\S+\s/, '') : null

  return (
    <div className="mentor-wrap">
      {/* El saludo de la primera vez (lo que hacía la ❓, ahora aquí) */}
      {saludo && !modo && (
        <div className="mentor-saludo">
          <button className="mentor-x" onClick={cerrarSaludo} aria-label="Cerrar">✕</button>
          <strong>🎓 {info.titulo}</strong>
          <p>{info.texto}</p>
          <button
            className="btn btn-oro mentor-saludo-si"
            onClick={() => { cerrarSaludo(); setModo('panel') }}
          >
            Sí, ayúdame
          </button>
        </div>
      )}

      {/* ── El panel de modos ── */}
      {modo === 'panel' && (
        <div className="mentor-panel">
          <div className="mentor-panel-cab">
            <span className="mentor-marca">🎓 Mentor ALTO</span>
            <button className="mentor-x" onClick={() => setModo(null)} aria-label="Cerrar">✕</button>
          </div>
          {vista === 'empresa' && (
            <button className="mentor-op" onClick={() => setModo('tocar')}>
              👆 ¿Qué es esto? — toca algo
            </button>
          )}
          <button className="mentor-op" onClick={() => setModo('noent')}>
            🤔 No entendí{nombreSeccion ? ` — ${nombreSeccion.toLowerCase()}` : ''}
          </button>
          {onTour && (
            <button className="mentor-op" onClick={() => { setModo(null); onTour() }}>
              🚶 Tour de esta pantalla
            </button>
          )}
          {onAtlas && (
            <button className="mentor-op" onClick={() => { setModo(null); onAtlas() }}>
              🧠 Preguntar a Atlas
            </button>
          )}
          <div className="mentor-progreso muted">
            ✔ Aprendidos: {contados.length} de {techo}
            {contados.length > 0 && (
              <>
                {' · '}
                {contados
                  .map((k) => tarjetaMentor(k, { nivel, empresa })?.titulo)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(', ')}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modo tocar: el aviso de arriba ── */}
      {modo === 'tocar' && (
        <div className="mentor-hint">
          👆 Toca cualquier parte con borde dorado
          <button className="mentor-hint-x" onClick={() => setModo('panel')}>salir</button>
        </div>
      )}

      {/* ── La tarjeta ── */}
      {modo === 'card' && tarjeta && (
        <div className="mentor-card">
          <div className="mentor-panel-cab">
            <span className="mentor-marca">
              {verEjemplo && tarjeta.ejemplo
                ? `${tarjeta.icono} ${tarjeta.ejemplo.titulo}`
                : `${tarjeta.icono} ${tarjeta.titulo}`}
            </span>
            <button className="mentor-x" onClick={() => setModo(null)} aria-label="Cerrar">✕</button>
          </div>
          <p className="mentor-cuerpo">
            {verEjemplo && tarjeta.ejemplo ? tarjeta.ejemplo.texto : tarjeta.cuerpo}
          </p>
          {!verEjemplo && tarjeta.notaLente && (
            <p className="mentor-lente">🔍 {tarjeta.notaLente}</p>
          )}
          <div className="mentor-acciones">
            {tarjeta.ejemplo && !verEjemplo && (
              <button className="mentor-mini" onClick={() => setVerEjemplo(true)}>
                Ver un ejemplo
              </button>
            )}
            {verEjemplo && (
              <button className="mentor-mini" onClick={() => setVerEjemplo(false)}>
                ← Volver
              </button>
            )}
            {tarjeta.siguiente && (
              <button className="mentor-mini" onClick={() => abrirTarjeta(tarjeta.siguiente.clave)}>
                {tarjeta.siguiente.texto} →
              </button>
            )}
            <button className="mentor-mini principal" onClick={entendido}>
              ✔ Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── "No entendí" contextual ── */}
      {modo === 'noent' && (
        <div className="mentor-card">
          <div className="mentor-panel-cab">
            <span className="mentor-marca">
              🤔 {nombreSeccion ? `Estás en ${nombreSeccion.toLowerCase()}` : '¿Qué no entendiste?'}
            </span>
            <button className="mentor-x" onClick={() => setModo('panel')} aria-label="Volver">✕</button>
          </div>
          {dudas.map((d) => (
            <button
              key={d.q}
              className="mentor-op"
              onClick={() => (d.clave ? abrirTarjeta(d.clave) : setModo(null))}
              disabled={!d.clave}
            >
              ○ {d.q}
            </button>
          ))}
          {/* Cada duda escrita es un voto: va a Comentarios, que ya existe. */}
          <a className="mentor-op mentor-op-link" href="#/comentarios" onClick={() => setModo(null)}>
            ✏️ Escríbeme tu duda…
          </a>
        </div>
      )}

      {/* ── La pill, siempre (salvo con algo abierto) ── */}
      {!modo && (
        <button
          className="mentor-pill"
          onClick={() => { cerrarSaludo(); setModo('panel') }}
          title="Mentor ALTO: te explico lo que estés mirando"
        >
          {etiqueta}
        </button>
      )}
    </div>
  )
}
