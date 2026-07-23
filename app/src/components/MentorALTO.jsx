import { useEffect, useMemo, useRef, useState } from 'react'
import {
  tarjetaMentor,
  hayTarjeta,
  dudasDe,
  SECCIONES,
  ETIQUETA_REPOSO,
  vistos,
  marcarVisto,
  dominados,
  marcarDominado,
  alcanzables,
  examinables,
  EVENTO_MENTOR,
} from '../lib/mentor'
import { cling } from '../lib/sonido'

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

// Los JSON de la casa se escriben con **negritas** (Jair las usa en tips y
// tesis). Un <p> no las entiende, así que la tarjeta las traduce aquí mismo:
// cuatro líneas y ninguna dependencia de markdown.
function conNegritas(texto) {
  return String(texto ?? '')
    .split(/(\*\*[^*]+\*\*)/g)
    .map((trozo, i) =>
      trozo.startsWith('**') && trozo.endsWith('**') && trozo.length > 4
        ? <strong key={i}>{trozo.slice(2, -2)}</strong>
        : trozo,
    )
}

// Saludo de la primera vez, heredado de la BurbujaTour que este botón absorbe.
const SALUDOS = {
  empresa: { clave: 'ficha', titulo: '¿Te explico esta ficha?', texto: 'Toca cualquier parte y te la explico con un ejemplo, o te llevo de la mano en un tour.' },
  inicio: { clave: 'inicio', titulo: '¿Primera vez por aquí?', texto: 'Soy tu mentor: te explico lo que estés mirando, cuando quieras.' },
  explorar: { clave: 'explorar', titulo: '¿Te explico cómo explorar?', texto: 'Cómo buscar, filtrar y batir 2 empresas en duelo — pasito a pasito.' },
  cuaderno: { clave: 'cuaderno', titulo: '¿Te muestro tu Cuaderno?', texto: 'Cargo una cartera de ejemplo y te enseño cada parte, de la mano.' },
  comparar: { clave: 'comparar', titulo: '¿Te explico el duelo?', texto: 'Cómo leer la carrera, la tabla y cuándo comparar dos empresas NO tiene sentido.' },
  resultados: { clave: 'resultados', titulo: '¿De dónde salieron estas?', texto: 'Te explico tu perfil, por qué estas empresas y qué hacer ahora.' },
}

// Cómo se llama, en cristiano, la pantalla que el tour va a recorrer. Solo
// para la línea chica del botón destacado: si no está, el botón no la escribe.
const NOMBRE_VISTA = {
  empresa: 'la ficha',
  inicio: 'el inicio',
  explorar: 'el explorador',
  cuaderno: 'tu Cuaderno',
  comparar: 'el duelo',
  resultados: 'tus resultados',
}

export default function MentorALTO({ vista, nivel = 2, empresa = null, onTour, onAtlas }) {
  // null = en reposo (solo la pill) · 'panel' · 'tocar' · 'card' · 'noent'
  const [modo, setModo] = useState(null)
  const [clave, setClave] = useState(null)   // la tarjeta abierta
  const [verEjemplo, setVerEjemplo] = useState(false)
  const [seccion, setSeccion] = useState(null) // dónde está parado el usuario
  const [aprendidos, setAprendidos] = useState(vistos)
  const [sabidos, setSabidos] = useState(dominados)
  // La mini-pregunta (#14): null = no la está rindiendo · {elegida, acerto}
  const [examen, setExamen] = useState(null)

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

  // 📖 Alguien pide una tarjeta desde fuera (hoy: el tooltip de Glosado).
  useEffect(() => {
    const al = (ev) => {
      const { clave: k, ejemplo } = ev.detail ?? {}
      if (!hayTarjeta(k, nivel)) return
      setClave(k)
      setVerEjemplo(!!ejemplo)
      setExamen(null) // si venía rindiendo otra, la nueva empieza por su texto
      setModo('card')
    }
    window.addEventListener(EVENTO_MENTOR, al)
    return () => window.removeEventListener(EVENTO_MENTOR, al)
  }, [nivel])

  // Esc: cierra lo que esté abierto, un escalón por vez.
  useEffect(() => {
    if (!modo) return
    const al = (e) => {
      if (e.key !== 'Escape') return
      if (examen) setExamen(null) // del examen se vuelve a la tarjeta, no afuera
      else if (modo === 'card' || modo === 'noent') setModo('panel')
      else setModo(null)
    }
    window.addEventListener('keydown', al)
    return () => window.removeEventListener('keydown', al)
  }, [modo, examen])

  const abrirTarjeta = (k) => {
    if (!hayTarjeta(k, nivel)) return // Regla #1: no se abre un panel vacío
    setClave(k)
    setVerEjemplo(false)
    setExamen(null)
    setModo('card')
  }

  const tarjeta = useMemo(
    () => (clave ? tarjetaMentor(clave, { nivel, empresa }) : null),
    [clave, nivel, empresa],
  )
  const yaDominada = !!clave && sabidos.includes(clave)

  // ✔ Entendido: eso es SIEMPRE "visto". Si la tarjeta tiene mini-pregunta y
  // todavía no la ha dominado, en vez de cerrarse le ofrece probarse — el ✔✔
  // no se regala por leer (#151-4).
  const entendido = () => {
    setAprendidos(marcarVisto(clave))
    if (tarjeta?.pregunta && !yaDominada) setExamen({ elegida: null, acerto: false })
    else setModo(null)
  }

  // Se puede reintentar tras fallar: la pista es la lección, no el castigo.
  // El ✔✔ se gana igual al acertar — lo que nunca se gana es sin contestar.
  const responder = (op, i) => {
    setExamen({ elegida: i, acerto: !!op.ok })
    if (!op.ok) return
    setSabidos(marcarDominado(clave))
    setAprendidos(vistos())
    cling() // el mismo premio de la moneda del inicio
  }

  const techo = useMemo(() => alcanzables(nivel).length, [nivel])
  const conPregunta = useMemo(() => examinables(nivel).length, [nivel])
  const contados = aprendidos.filter((k) => hayTarjeta(k, nivel))
  const dominadosNivel = sabidos.filter((k) => hayTarjeta(k, nivel))
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
          {/* El tour va PRIMERO y resaltado: de las cuatro puertas es la única
              que no exige que el usuario ya sepa qué preguntar — las otras tres
              esperan una duda concreta. Al que llega perdido se le ofrece la
              mano antes que el índice (#151-7). */}
          {onTour && (
            <button
              className="mentor-op mentor-op-destacada"
              onClick={() => { setModo(null); onTour() }}
            >
              <span className="mentor-op-cinta">Recomendado</span>
              🚶 Tour de esta pantalla
              <small>Te la muestro entera, de la mano{NOMBRE_VISTA[vista] ? ` — ${NOMBRE_VISTA[vista]}` : ''}</small>
            </button>
          )}
          {vista === 'empresa' && (
            <button className="mentor-op" onClick={() => setModo('tocar')}>
              👆 ¿Qué es esto? — toca algo
            </button>
          )}
          <button className="mentor-op" onClick={() => setModo('noent')}>
            🤔 No entendí{nombreSeccion ? ` — ${nombreSeccion.toLowerCase()}` : ''}
          </button>
          {onAtlas && (
            <button className="mentor-op" onClick={() => { setModo(null); onAtlas() }}>
              🧠 Preguntar a Atlas
            </button>
          )}
          {/* Dos contadores distintos porque son dos cosas distintas: haber
              leído y haber contestado. Mezclarlos sería el halago fácil. */}
          <div className="mentor-progreso muted">
            ✔ Leídas: {contados.length} de {techo}
            {conPregunta > 0 && (
              <>
                {' · '}
                <span className={dominadosNivel.length ? 'mentor-sello' : undefined}>
                  ✔✔ Dominadas: {dominadosNivel.length} de {conPregunta}
                </span>
              </>
            )}
            {contados.length > 0 && (
              <>
                <br />
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
      {modo === 'card' && tarjeta && !examen && (
        <div className="mentor-card">
          <div className="mentor-panel-cab">
            <span className="mentor-marca">
              {verEjemplo && tarjeta.ejemplo
                ? `${tarjeta.icono} ${tarjeta.ejemplo.titulo}`
                : `${tarjeta.icono} ${tarjeta.titulo}`}
              {yaDominada && !verEjemplo && <span className="mentor-sello" title="Dominado: contestaste bien su pregunta"> ✔✔</span>}
            </span>
            <button className="mentor-x" onClick={() => setModo(null)} aria-label="Cerrar">✕</button>
          </div>
          <p className="mentor-cuerpo">
            {conNegritas(verEjemplo && tarjeta.ejemplo ? tarjeta.ejemplo.texto : tarjeta.cuerpo)}
          </p>
          {!verEjemplo && tarjeta.notaLente && (
            <p className="mentor-lente">🔍 {conNegritas(tarjeta.notaLente)}</p>
          )}
          {/* Los dos escalones de arriba (§6): aparecen solos según el nivel —
              el nivel 3 gana "cuándo miente" y el 4 suma "cómo se combina". */}
          {!verEjemplo && tarjeta.trampa && (
            <p className="mentor-lente mentor-trampa">
              <b>⚠️ Cuándo miente:</b> {conNegritas(tarjeta.trampa)}
            </p>
          )}
          {!verEjemplo && tarjeta.combo && (
            <p className="mentor-lente mentor-combo">
              <b>🔗 Cómo lo cruza un analista:</b> {conNegritas(tarjeta.combo)}
            </p>
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
              {tarjeta.pregunta && !yaDominada ? '✔ Entendido — pruébame' : '✔ Entendido'}
            </button>
          </div>
        </div>
      )}

      {/* ── La mini-pregunta (#14): el único camino al ✔✔ ── */}
      {modo === 'card' && tarjeta?.pregunta && examen && (
        <div className="mentor-card">
          <div className="mentor-panel-cab">
            <span className="mentor-marca">
              {examen.acerto ? '✔✔ ¡Esa es!' : `${tarjeta.icono} Una sola pregunta`}
            </span>
            <button className="mentor-x" onClick={() => setModo(null)} aria-label="Cerrar">✕</button>
          </div>

          {examen.acerto ? (
            <>
              <p className="mentor-cuerpo">
                {conNegritas(tarjeta.pregunta.opciones[examen.elegida].t)}
              </p>
              <p className="mentor-lente mentor-premio">
                🪙 <b>{tarjeta.titulo}</b> queda marcada como <b>dominada</b> — no por
                haberla leído, sino porque la contestaste.
              </p>
              <div className="mentor-acciones">
                {tarjeta.siguiente && (
                  <button className="mentor-mini" onClick={() => abrirTarjeta(tarjeta.siguiente.clave)}>
                    {tarjeta.siguiente.texto} →
                  </button>
                )}
                <button className="mentor-mini principal" onClick={() => setModo(null)}>
                  Seguir mirando
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mentor-cuerpo">{conNegritas(tarjeta.pregunta.q)}</p>
              {tarjeta.pregunta.opciones.map((op, i) => (
                <button
                  key={op.t}
                  className={`mentor-op${examen.elegida === i ? ' mentor-op-fallo' : ''}`}
                  onClick={() => responder(op, i)}
                >
                  ○ {op.t}
                </button>
              ))}
              {examen.elegida != null && (
                <p className="mentor-lente mentor-pista">
                  💡 {conNegritas(tarjeta.pregunta.opciones[examen.elegida].pista || 'Esa no es. Vuelve a leerla y prueba otra.')}
                </p>
              )}
              <div className="mentor-acciones">
                <button className="mentor-mini" onClick={() => setExamen(null)}>
                  ← Volver a leerla
                </button>
                <button className="mentor-mini" onClick={() => setModo(null)}>
                  Otro día
                </button>
              </div>
            </>
          )}
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
