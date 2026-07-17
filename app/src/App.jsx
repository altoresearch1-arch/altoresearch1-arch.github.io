import { useEffect, useRef, useState } from 'react'
import config from './data/config.json'
import empresasData from './data/empresas.json'
import Quiz from './components/Quiz'
import Resultados from './components/Resultados'
import Empresa from './components/Empresa'
import Glosario from './components/Glosario'
import Explorar from './components/Explorar'
import Comparador from './components/Comparador'
import ApoyoModal from './components/ApoyoModal'
import Pildora from './components/Pildora'
import Disclaimer from './components/Disclaimer'
import HoyBVL from './components/HoyBVL'
import EmpresaDelDia from './components/EmpresaDelDia'
import MiLista from './components/MiLista'
import Cuaderno from './components/Cuaderno'
import CuadernoPortada from './components/CuadernoPortada'
import MonedaFidget from './components/MonedaFidget'
import FondoVivo from './components/FondoVivo'
import Atlas from './components/Atlas'
import Comentarios from './components/Comentarios'
import Gracias from './components/Gracias'
import AvisoNovedades from './components/AvisoNovedades'
import SelectorNivel from './components/SelectorNivel'
import NivelBadge from './components/NivelBadge'
import NivelTransicion from './components/NivelTransicion'
import MenuNav from './components/MenuNav'
import BuscadorInicio from './components/BuscadorInicio'
import CintaBVL from './components/CintaBVL'
import GanchoDatos from './components/GanchoDatos'
import TourGuia, { PASOS_INICIO, PASOS_FICHA } from './components/TourGuia'
import BurbujaTour from './components/BurbujaTour'
import { useNivel, aplicarTemaNivel } from './lib/nivel'

// "2026-06-24" -> "24 de junio de 2026"
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function fechaLegible(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${a}`
}

const TEXTO_VOLVER = {
  inicio: '← Volver al inicio',
  resultados: '← Volver a resultados',
  explorar: '← Volver al explorador',
  comparar: '← Volver a la comparación',
  cuaderno: '← Volver a mi cuaderno',
}

// Rutas por hash (#/empresa/BVN, #/explorar, …): cada ficha tiene su LINK
// propio (se puede compartir) y el botón atrás del navegador/celular funciona.
// El hash es la fuente de verdad de la vista; la UI navega cambiando el hash.
export default function App() {
  const [nivel, setNivel] = useNivel()
  const [vista, setVista] = useState('inicio')
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Transición de nivel: pantalla de carga honesta que tapa el re-armado de la
  // interfaz. Se dispara ante CUALQUIER cambio de nivel (puerta de entrada,
  // badge de la barra o CTA "¿Subimos el nivel?" de la ficha) porque escucha
  // el estado, no los botones. En la primera carga no hay transición.
  const [transicion, setTransicion] = useState(null)
  const nivelPrevio = useRef(nivel)
  useEffect(() => {
    if (nivelPrevio.current !== nivel && nivel != null) setTransicion(nivel)
    nivelPrevio.current = nivel
  }, [nivel])

  // Tema visual del nivel (densidad, radio, velocidad): vive en <html data-nivel>
  useEffect(() => { aplicarTemaNivel(nivel) }, [nivel])

  // 🚶 Tour guiado: 'inicio' | 'ficha' | null. Se abre desde la burbuja ❓
  // (abajo-izquierda, siempre presente en inicio y ficha) o desde el menú ☰.
  const [tour, setTour] = useState(null)
  // si cambias de pantalla a mitad del tour, se cierra: sus pasos apuntaban
  // a la pantalla anterior (el setTimeout de abrirTour llega DESPUÉS de esto)
  useEffect(() => { setTour(null) }, [vista])
  const abrirTour = () => {
    if (vista === 'empresa') setTour('ficha')
    else if (vista === 'inicio') setTour('inicio')
    else {
      // desde otra pantalla: primero al inicio, luego arranca (deja montar el DOM)
      irA('#/')
      setTimeout(() => setTour('inicio'), 400)
    }
  }
  const [respuestas, setRespuestas] = useState(null)
  const [tickerSel, setTickerSel] = useState(null)
  const [origenEmpresa, setOrigenEmpresa] = useState('inicio')
  const [compararTickers, setCompararTickers] = useState(null)
  const [apoyoAbierto, setApoyoAbierto] = useState(false)
  // Panel de Actualizaciones: plegable, y GUARDADO (colapsado) por defecto
  // (pedido de Jair). Recuerda la elección del usuario entre visitas.
  const [actualizAbiertas, setActualizAbiertas] = useState(() => {
    try { return localStorage.getItem('alto-actualizaciones-abiertas') === '1' } catch { return false }
  })
  const toggleActualiz = () => setActualizAbiertas((v) => {
    const n = !v
    try { localStorage.setItem('alto-actualizaciones-abiertas', n ? '1' : '0') } catch { /* sin storage */ }
    return n
  })

  // el listener de hashchange necesita leer las respuestas actuales
  const respuestasRef = useRef(null)
  useEffect(() => { respuestasRef.current = respuestas }, [respuestas])

  useEffect(() => {
    const aplicarHash = () => {
      const [ruta, a, b] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
      const existe = (t) => empresasData.empresas.some((e) => e.ticker === t)
      if (!ruta) setVista('inicio')
      else if (ruta === 'quiz') setVista('quiz')
      else if (ruta === 'resultados') setVista(respuestasRef.current ? 'resultados' : 'quiz')
      else if (ruta === 'glosario') setVista('glosario')
      else if (ruta === 'explorar') setVista('explorar')
      else if (ruta === 'ia') setVista('ia')
      else if (ruta === 'cuaderno') setVista('cuaderno')
      else if (ruta === 'comentarios') setVista('comentarios')
      else if (ruta === 'gracias') setVista('gracias')
      else if (ruta === 'empresa' && a && existe(a)) {
        setTickerSel(a)
        setVista('empresa')
      } else if (ruta === 'comparar') {
        if (a && b && existe(a) && existe(b)) setCompararTickers([a, b])
        setVista('comparar')
      } else setVista('inicio')
    }
    window.addEventListener('hashchange', aplicarHash)
    aplicarHash() // permite abrir un link directo tipo #/empresa/BVN
    return () => window.removeEventListener('hashchange', aplicarHash)
  }, [])

  // al cambiar de vista, arrancar arriba (como una app de verdad)
  useEffect(() => { window.scrollTo(0, 0) }, [vista, tickerSel])

  const irA = (hash) => {
    if (location.hash === hash) return
    location.hash = hash
  }

  const irInicio = () => {
    setRespuestas(null)
    setTickerSel(null)
    irA('#/')
  }

  const abrirEmpresa = (ticker, origen) => {
    setOrigenEmpresa(origen)
    irA(`#/empresa/${ticker}`)
  }

  const empresaAleatoria = () => {
    const lista = empresasData.empresas
    const elegida = lista[Math.floor(Math.random() * lista.length)]
    abrirEmpresa(elegida.ticker, 'inicio')
  }

  // Topbar descongestionada (antes: 8 elementos en un renglón): en escritorio
  // van solo los 4 destinos de uso diario; Comentarios/Gracias/Apóyanos viven
  // en el menú ☰ (MenuNav). En celular, TODO va al menú: queda marca + nivel + ☰.
  const navPrimario = [
    { id: 'inicio', label: 'Inicio', hash: '#/' },
    { id: 'explorar', label: 'Explorar', hash: '#/explorar' },
    { id: 'cuaderno', label: '📓 Cuaderno', hash: '#/cuaderno', beta: true },
    { id: 'ia', label: '🧠 Atlas', hash: '#/ia', beta: true },
  ]

  // Puerta de entrada obligatoria: hasta que elija un nivel, no ve nada más.
  if (nivel == null) {
    return (
      <>
        <FondoVivo />
        <div className="aurora" aria-hidden="true" />
        <SelectorNivel onElegir={setNivel} />
        {transicion != null && (
          <NivelTransicion nivelId={transicion} onFin={() => setTransicion(null)} />
        )}
      </>
    )
  }

  return (
    <>
      <FondoVivo />
      <div className="aurora" aria-hidden="true" />
      <div className="app-shell">
        <div className="topbar">
          <div className="brand" onClick={irInicio}>
            <img
              className="brand-logo"
              src={`${import.meta.env.BASE_URL}logo-alto.jpg`}
              alt="ALTO Research"
            />
            <span className="mark">ALTO</span>
            <span className="sub">Research</span>
          </div>
          <nav className="nav">
            <div className="nav-links">
              {navPrimario.map((it) => (
                <button
                  key={it.id}
                  className={vista === it.id ? 'activo' : ''}
                  onClick={() => irA(it.hash)}
                >
                  {it.label}
                  {it.beta && <span className="nav-beta">beta</span>}
                </button>
              ))}
            </div>
            <NivelBadge nivel={nivel} onCambiar={setNivel} />
            <button
              className="nav-menu"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
            >
              ☰
            </button>
          </nav>
        </div>

        {menuAbierto && (
          <MenuNav
            vista={vista}
            onIr={irA}
            onApoyar={() => setApoyoAbierto(true)}
            onTour={abrirTour}
            onCerrar={() => setMenuAbierto(false)}
          />
        )}

        {/* key={vista}: remonta el contenido al cambiar de vista -> transición suave */}
        <div key={vista + (tickerSel || '')} className="vista-anim">
          {vista === 'inicio' && (() => {
            // 🆕 Actualizaciones (reemplaza al "mensaje del día", pedido de Jair 09-jul):
            // las mejoras REALES de la app, editables en config.json
            const bloqueActualizaciones = config.actualizaciones?.items?.length > 0 && (
              <div className="mensaje-dia">
                <button
                  className="mensaje-dia-cab actualizaciones-toggle"
                  onClick={toggleActualiz}
                  aria-expanded={actualizAbiertas}
                >
                  <span>
                    🆕 Actualizaciones
                    {!actualizAbiertas && (
                      <span className="actualizaciones-cuenta">
                        {' '}({config.actualizaciones.items.length})
                      </span>
                    )}
                  </span>
                  <span className="mensaje-dia-fecha">
                    {fechaLegible(config.actualizaciones.items[0].fecha)}
                    <span className="actualizaciones-flecha">{actualizAbiertas ? '▲' : '▼'}</span>
                  </span>
                </button>
                {actualizAbiertas && (
                  <ul className="actualizaciones-lista">
                    {config.actualizaciones.items.slice(0, 6).map((it, i) => (
                      <li key={i}>{it.texto}</li>
                    ))}
                  </ul>
                )}
              </div>
            )

            const bloqueHero = (
              <div className="hero">
                {/* El logo gigante ES la moneda anti-estrés: clícalo y salta/gira/suena */}
                <MonedaFidget />
                <div className="kicker">{config.marca.tagline}</div>
                <h1>
                  Descubre acciones de la BVL{' '}
                  <span className="oro">para estudiar</span>
                </h1>
                <p className="lead">
                  Responde 4 preguntas y te mostramos empresas de la Bolsa de
                  Valores de Lima que encajan con tu perfil — para que las
                  analices tú mismo. Gratis y educativo.
                </p>
                {/* 🎣 Gancho de curiosidad con datos REALES (niveles 1-2): una
                    prueba viva de lo que hay adentro, antes de pedir el quiz */}
                {nivel <= 2 && <GanchoDatos onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />}
                {/* Un solo protagonista (el quiz); el resto son atajos discretos */}
                <div className="hero-actions">
                  <button className="btn btn-oro" onClick={() => irA('#/quiz')}>
                    🎯 Empezar el quiz
                  </button>
                </div>
                <div className="hero-atajos">
                  <button onClick={() => irA('#/explorar')}>
                    🔎 Explorar las {empresasData.empresas.length}
                  </button>
                  <button onClick={() => irA('#/glosario')}>📖 Glosario</button>
                  <button onClick={() => irA('#/ia')}>
                    🧠 Atlas <span className="nav-beta">beta</span>
                  </button>
                  <button onClick={empresaAleatoria}>🎲 Una al azar</button>
                </div>
              </div>
            )

            const bloqueMercado = (
              <>
                <BuscadorInicio onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                {/* 📓 La puerta del Cuaderno: el inicio saluda con TUS números */}
                <CuadernoPortada onAbrir={() => irA('#/cuaderno')} />
                <MiLista onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                <HoyBVL onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                <EmpresaDelDia onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
              </>
            )

            // Orden según el público: niveles 1-2 entran a APRENDER (hero al
            // frente); niveles 3-4 entran a TRABAJAR (buscador y mercado primero,
            // el hero con su moneda queda abajo).
            return (
              <div>
                {/* 📟 La cinta bursátil: el mercado late apenas entras (todos los niveles) */}
                <CintaBVL onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                {bloqueActualizaciones}
                {nivel >= 3 ? (
                  <>
                    {bloqueMercado}
                    {bloqueHero}
                  </>
                ) : (
                  <>
                    {bloqueHero}
                    {bloqueMercado}
                  </>
                )}
                <Pildora />
                <div className="space" />
                <Disclaimer />
              </div>
            )
          })()}

          {vista === 'quiz' && (
            <Quiz
              onTerminar={(r) => {
                setRespuestas(r)
                irA('#/resultados')
              }}
              onAleatoria={empresaAleatoria}
            />
          )}

          {vista === 'resultados' && respuestas && (
            <Resultados
              respuestas={respuestas}
              onVerEmpresa={(t) => abrirEmpresa(t, 'resultados')}
              onReiniciar={() => {
                setRespuestas(null)
                irA('#/quiz')
              }}
            />
          )}

          {vista === 'empresa' && tickerSel && (
            <Empresa
              ticker={tickerSel}
              onVolver={() => irA(origenEmpresa === 'inicio' ? '#/'
                : origenEmpresa === 'comparar' ? '#/comparar'
                : `#/${origenEmpresa}`)}
              volverTexto={TEXTO_VOLVER[origenEmpresa] || TEXTO_VOLVER.inicio}
            />
          )}

          {vista === 'glosario' && <Glosario />}

          {vista === 'ia' && <Atlas onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />}

          {vista === 'cuaderno' && <Cuaderno onVerEmpresa={(t) => abrirEmpresa(t, 'cuaderno')} />}

          {vista === 'comentarios' && <Comentarios />}

          {vista === 'gracias' && <Gracias onApoyar={() => setApoyoAbierto(true)} />}

          {vista === 'explorar' && (
            <Explorar
              onVerEmpresa={(t) => abrirEmpresa(t, 'explorar')}
              onComparar={(pareja) => {
                setCompararTickers(pareja)
                irA(`#/comparar/${pareja[0]}/${pareja[1]}`)
              }}
            />
          )}

          {vista === 'comparar' && (
            <Comparador
              tickers={compararTickers}
              onVolver={() => irA('#/explorar')}
              onVerEmpresa={(t) => abrirEmpresa(t, 'comparar')}
            />
          )}
        </div>
      </div>

      {/* Pantalla de transición al cambiar de nivel (tapa el re-armado de la UI) */}
      {transicion != null && (
        <NivelTransicion nivelId={transicion} onFin={() => setTransicion(null)} />
      )}

      {/* 🚶 Tour guiado: burbuja ❓ siempre a la mano (inicio y ficha) + el tour */}
      {/* key={vista}: al cambiar de pantalla se remonta y re-lee su saludo
          (si no, el estado inicial del saludo se queda pegado al del inicio) */}
      {tour == null && transicion == null && (vista === 'inicio' || vista === 'empresa') && (
        <BurbujaTour key={vista} vista={vista} onAbrir={abrirTour} />
      )}
      {tour != null && (
        <TourGuia
          pasos={tour === 'ficha' ? PASOS_FICHA : PASOS_INICIO}
          onCerrar={() => setTour(null)}
        />
      )}

      {/* 🔔 Avisos en vivo: hechos nuevos de las empresas guardadas con ★ */}
      <AvisoNovedades />

      {/* Botón flotante de apoyo (siempre visible) */}
      <button className="apoyo-pill" onClick={() => setApoyoAbierto(true)}>
        <span className="apoyo-pill-corazon">💛</span>
        Apóyame con un
        <span className="apoyo-pill-badge yape">yape</span>
        <span className="apoyo-pill-badge paypal">PayPal</span>
      </button>

      {apoyoAbierto && <ApoyoModal onCerrar={() => setApoyoAbierto(false)} />}

      <footer className="footer">
        {config.marca.nombre} · {config.marca.subtitulo}
        <br />
        Contenido educativo · no es recomendación de inversión · el mercado manda.
      </footer>
    </>
  )
}
