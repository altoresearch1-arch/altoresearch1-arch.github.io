import { useEffect, useMemo, useRef, useState } from 'react'
import { muroTitulares, sectoresDelMuro, leerVistos, marcarVistos, noticiasGeneradas } from '../lib/radar'
import pagosData from '../data/pagos_dividendos.json'

// 📰 EL MURO — titulares en formato tablero de sala de trading: el más nuevo
// arriba, ámbar sobre negro, denso y de un vistazo. (La paleta de Bloomberg
// es ámbar sobre negro porque en un monitor de fósforo era lo que menos
// cansaba la vista; acá cae de suerte que es la misma que ALTO ya usa.)
//
// LO NUEVO ES NUEVO PARA TI, no "de hoy". Un tablero que marca como nuevo lo
// que ya leíste ayer deja de servir a la semana. Se recuerda en tu navegador
// qué titulares ya pasaron por tus ojos (lib/radar.js) y se marcan al SALIR
// de la pantalla, no al entrar — si no, el distintivo se apagaría mientras
// lo estás leyendo.
//
// Regla de Oro: solo titular, medio, fecha y link. El cuerpo de la nota es
// de su medio y se lee allá — cada línea es un enlace a la fuente.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MESES[parseInt(m, 10) - 1]}`
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Próximos pagos de dividendos ya acordados: el equivalente honesto del
// "Later Today" de Bloomberg. No es un pronóstico — es una fecha que la
// empresa YA comunicó en un Hecho de Importancia (con su PDF).
function proximosPagos(limite = 5) {
  const hoy = hoyISO()
  const lista = []
  for (const [ticker, pagos] of Object.entries(pagosData.empresas || {})) {
    for (const p of pagos || []) {
      if (p.fecha && p.fecha >= hoy) lista.push({ ticker, ...p })
    }
  }
  return lista.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).slice(0, limite)
}

// Cuántos titulares se pintan de entrada. En escritorio el flujo tiene su
// propio scroll y da igual, pero en celular los 142 de una tanda miden 8.500
// píxeles: nadie llega a «Lo candente» pasando eso con el pulgar.
const TANDA = 40

const NOMBRE_SECTOR = {
  minas: 'Minas', acereras: 'Acereras', cemento: 'Cemento', bancos: 'Bancos',
  electricas: 'Eléctricas', alimentos: 'Alimentos', retail: 'Retail',
  textil: 'Textil', pesqueras: 'Pesqueras', fondos: 'Fondos', diversas: 'Diversas',
}

export default function MuroNoticias({ filas = [], ruedas = 20, onVerEmpresa }) {
  const todos = useMemo(() => muroTitulares(filas, ruedas), [filas, ruedas])
  const pagos = useMemo(() => proximosPagos(), [])
  const [tope, setTope] = useState(TANDA)
  const [sector, setSector] = useState(null) // null = todos

  const sectores = useMemo(() => sectoresDelMuro(todos), [todos])
  const titulares = useMemo(() => {
    if (!sector) return todos
    return todos.filter((n) => (n.origen === 'tema'
      ? (n.sectores || []).includes(sector)
      : n.sector === sector))
  }, [todos, sector])

  // El set de vistos se congela al montar: si se releyera en cada render, los
  // distintivos irían desapareciendo solos mientras el usuario lee.
  const [vistos] = useState(() => leerVistos())
  // Solo se marcan como leídos los titulares REALMENTE PINTADOS. Si marcáramos
  // los 142 y en pantalla hubo 40, los otros 102 perderían su «NUEVO» sin que
  // nadie los haya visto — el distintivo dejaría de significar nada.
  const urlsRef = useRef([])
  urlsRef.current = titulares.slice(0, tope).map((n) => n.url)

  // Marcar al salir (desmontar). También al cerrar la pestaña: sin esto, el
  // que mira el muro y cierra el navegador vuelve mañana y ve todo "nuevo"
  // otra vez.
  useEffect(() => {
    const marcar = () => marcarVistos(urlsRef.current)
    window.addEventListener('pagehide', marcar)
    return () => {
      window.removeEventListener('pagehide', marcar)
      marcar()
    }
  }, [])

  const nuevos = todos.filter((n) => !vistos.has(n.url)).length

  const movers = useMemo(
    () => filas
      .filter((f) => f.retornos[ruedas] != null)
      .sort((a, b) => Math.abs(b.retornos[ruedas]) - Math.abs(a.retornos[ruedas]))
      .slice(0, 8),
    [filas, ruedas],
  )

  if (!todos.length) {
    return (
      <div className="card">
        <h3 style={{ margin: '0 0 6px' }}>📰 Muro de titulares</h3>
        <p className="muted" style={{ margin: 0 }}>
          Todavía no hay titulares guardados. Corre{' '}
          <code>python extractor/fetch_noticias.py</code> y vuelve.
        </p>
      </div>
    )
  }

  return (
    <div className="muro card">
      <div className="muro-barra">
        <h3 style={{ margin: 0 }}>📰 Muro de titulares</h3>
        <div className="muro-barra-der">
          {nuevos > 0 && <span className="muro-cuenta">{nuevos} sin leer</span>}
          {noticiasGeneradas && <span className="muted">{noticiasGeneradas}</span>}
        </div>
      </div>

      {/* Filtro por sector: el arreglo de fondo es el orden y el cupo, pero
          cuando quieres VER acereras y solo acereras, esto lo resuelve de un
          clic. Cada chip trae cuántos titulares tiene. */}
      <div className="muro-filtros">
        <button
          className={'muro-filtro' + (sector === null ? ' activo' : '')}
          onClick={() => { setSector(null); setTope(TANDA) }}
        >
          Todos <span className="tema-n">{todos.length}</span>
        </button>
        {sectores.map((s) => (
          <button
            key={s.sector}
            className={'muro-filtro' + (sector === s.sector ? ' activo' : '')}
            onClick={() => { setSector(s.sector === sector ? null : s.sector); setTope(TANDA) }}
          >
            {NOMBRE_SECTOR[s.sector] || s.sector} <span className="tema-n">{s.n}</span>
          </button>
        ))}
      </div>

      <div className="muro-cols">
        {/* ── El flujo: primero lo que se movió fuerte, con cupo por empresa ── */}
        <div className="muro-flujo">
          {titulares.slice(0, tope).map((n) => {
            const esNuevo = !vistos.has(n.url)
            return (
              <a
                key={n.url}
                className={'muro-linea' + (esNuevo ? ' nuevo' : '')}
                href={n.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="muro-fecha">{fechaCorta(n.fecha)}</span>
                <span className={'muro-chip' + (n.origen === 'tema' ? ' tema' : '')}>
                  {n.origen === 'tema' ? n.icono : n.etiqueta}
                </span>
                <span className="muro-titulo">
                  {esNuevo && <span className="muro-nuevo">NUEVO</span>}
                  {n.titulo}
                  <span className="muro-medio"> · {n.medio || 'prensa'}</span>
                  {n.fuerza >= 1 && (
                    <span className="muro-fuerza" title="se movió más de lo normal en ella">
                      🔥 {n.fuerza.toFixed(1)}×
                    </span>
                  )}
                </span>
              </a>
            )
          })}
          {tope < titulares.length && (
            <button
              className="muro-mas"
              onClick={() => setTope((t) => t + TANDA)}
            >
              ver {Math.min(TANDA, titulares.length - tope)} titulares más
              <span className="muted"> · {titulares.length - tope} restantes</span>
            </button>
          )}
        </div>

        {/* ── La columna lateral: el mercado y lo que viene ── */}
        <aside className="muro-lado">
          <div className="muro-panel">
            <div className="muro-panel-tit">El mercado</div>
            {movers.map((f) => {
              const pct = f.retornos[ruedas]
              return (
                <button key={f.ticker} className="muro-mover" onClick={() => onVerEmpresa?.(f.ticker)}>
                  <span className="muro-mover-tk">{f.ticker}</span>
                  <span className="muro-mover-px muted">
                    {f.moneda} {f.precio}
                  </span>
                  <span className={'muro-mover-pct ' + (pct >= 0 ? 'sube' : 'baja')}>
                    {pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%
                  </span>
                </button>
              )
            })}
            <div className="muro-panel-pie muted">
              variación de {ruedas} ruedas · cierres BVL
            </div>
          </div>

          {pagos.length > 0 && (
            <div className="muro-panel">
              <div className="muro-panel-tit">Lo que viene</div>
              {pagos.map((p) => (
                <a
                  key={`${p.ticker}-${p.fecha}-${p.parte}`}
                  className="muro-pago"
                  href={p.pdf || undefined}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { if (!p.pdf) e.preventDefault() }}
                >
                  <span className="muro-pago-fecha">{fechaCorta(p.fecha)}</span>
                  <span className="muro-pago-tk">{p.ticker}</span>
                  <span className="muro-pago-monto">
                    {p.moneda} {p.monto}
                    {p.partes > 1 && <span className="muted"> ({p.parte}/{p.partes})</span>}
                  </span>
                </a>
              ))}
              <div className="muro-panel-pie muted">
                pagos de dividendo ya acordados (Hecho de Importancia)
              </div>
            </div>
          )}
        </aside>
      </div>

      <p className="muted muro-pie">
        Ordenado por <b>cuánto se movió la acción</b>, no por la hora de
        publicación — y con tope de 2 titulares por empresa. Sin eso el tablero
        se llenaba de minería (50 de 142 titulares) y las acereras no
        aparecían: la prensa minera peruana publica mucho más, y publicar más
        no es moverse más. «NUEVO» es lo que <b>tú</b> no habías visto, no lo
        de hoy; se marca como leído al salir de esta pantalla.
      </p>
    </div>
  )
}
