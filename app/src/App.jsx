import { useEffect, useMemo, useRef, useState } from 'react'
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
import Bienvenida from './components/Bienvenida'
import LeccionExpres, { leccionVista, marcarLeccionVista, pasoLeccion } from './components/LeccionExpres'
import Enganche from './components/Enganche'
import PuertaTardia, { tocaPuertaTardia, marcarFichaVista } from './components/PuertaTardia'
import RepasoLeccion from './components/RepasoLeccion'
import { pedirModoTocar } from './lib/mentor'
import PlanInversor from './components/PlanInversor'
import NivelBadge from './components/NivelBadge'
import NivelTransicion from './components/NivelTransicion'
import MenuNav from './components/MenuNav'
import BuscadorInicio from './components/BuscadorInicio'
import CintaBVL from './components/CintaBVL'
import GanchoDatos from './components/GanchoDatos'
import SeccionInicio from './components/SeccionInicio'
import TourGuia, { PASOS_INICIO, PASOS_EXPLORAR, PASOS_COMPARADOR, PASOS_RESULTADOS } from './components/TourGuia'
import MentorALTO from './components/MentorALTO'
import OfertaDesbloqueo from './components/OfertaDesbloqueo'
import { pasosFicha, pasosDesbloqueo } from './lib/guiontour'
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
  // 🚪 En qué paso de la entrada está quien todavía no tiene nivel:
  // 'bienvenida' (qué es esto) → 'enganche' (la conversación que detecta qué
  // ha escuchado) → 'leccion' (las 7 tarjetas del 🐣) o 'niveles' (el selector
  // de siempre, para el que ya sabe). El enganche PUEDE saltarse la lección:
  // a quien reconoce y entiende no se le hace repetir lo que ya sabe.
  const [entrada, setEntrada] = useState('bienvenida')
  // 🎣 Lo que decidió la conversación: a qué nivel entra y con qué ficha se le
  // cierra el recorrido. Vive acá porque sobrevive al paso por la lección.
  const [plan, setPlan] = useState(null)
  // 🎚️ La puerta de niveles del final: se decide UNA vez al montar y cuando
  // se vuelve al inicio, para no mirar localStorage en cada render.
  const [puertaTardia, setPuertaTardia] = useState(false)
  // 🐣 La lección exprés reabierta desde el menú ☰ (ya con nivel elegido).
  const [leccionAbierta, setLeccionAbierta] = useState(false)
  // 🎣 El enganche reabierto desde el ☰: con 112 preguntas en el banco, volver
  // trae cosas nuevas. Acá NO cambia el nivel solo: ya lo eligió.
  const [engancheAbierto, setEngancheAbierto] = useState(false)
  // 📋 «Ver mi plan»: abre el mismo componente pero directo en el cierre, con
  // los pasos que ya tiene ganados. No es otra pantalla: es la misma, sin
  // obligarlo a contestar ocho preguntas para volver a leer lo suyo.
  const [engancheVerPlan, setEngancheVerPlan] = useState(false)
  // Desde qué escalón arranca la conversación. Lo dice el propio usuario en la
  // puerta: el que responde «más o menos, pero nunca lo entendí bien» no
  // empieza en «¿qué es una acción?» — se le cree y se le sube un escalón.
  const [escalonEnganche, setEscalonEnganche] = useState(1)

  // Transición de nivel: pantalla de carga honesta que tapa el re-armado de la
  // interfaz. Se dispara ante CUALQUIER cambio de nivel (puerta de entrada,
  // badge de la barra o CTA "¿Subimos el nivel?" de la ficha) porque escucha
  // el estado, no los botones. En la primera carga no hay transición.
  const [transicion, setTransicion] = useState(null)
  const nivelPrevio = useRef(nivel)
  // 🔓 Tour de DESBLOQUEO (#2 del plan educativo): si el usuario SUBE de nivel
  // estando dentro de una ficha, ese momento — el de mayor curiosidad y mayor
  // confusión — dejaba de estar mudo: le ofrecemos presentarle SOLO lo que
  // acaba de aparecer, con los datos de esa empresa.
  const [oferta, setOferta] = useState(null)
  useEffect(() => {
    if (nivelPrevio.current !== nivel && nivel != null) {
      setTransicion(nivel)
      if (vista === 'empresa' && nivel > (nivelPrevio.current ?? 0)) setOferta(nivel)
    }
    nivelPrevio.current = nivel
  }, [nivel, vista])

  // Tema visual del nivel (densidad, radio, velocidad): vive en <html data-nivel>
  useEffect(() => { aplicarTemaNivel(nivel) }, [nivel])

  // 🎚️ ¿Toca ofrecerle los 4 niveles? Solo al volver al INICIO, y solo si
  // entró por el 🐣 y ya miró su primera ficha (ver PuertaTardia.jsx).
  useEffect(() => {
    if (vista === 'inicio') setPuertaTardia(tocaPuertaTardia(nivel))
  }, [vista, nivel])

  // 🚶 Tour guiado: 'inicio' | 'ficha' | null. Se abre desde la burbuja ❓
  // (abajo-izquierda, siempre presente en inicio y ficha) o desde el menú ☰.
  const [tour, setTour] = useState(null)
  // si cambias de pantalla a mitad del tour, se cierra: sus pasos apuntaban
  // a la pantalla anterior (el setTimeout de abrirTour llega DESPUÉS de esto)
  useEffect(() => { setTour(null) }, [vista])
  // El tour de Mi Cuaderno lo maneja el propio Cuaderno (carga una cartera de
  // ejemplo antes de arrancar); aquí guardamos su disparador.
  const arrancarTourCuaderno = useRef(null)
  const abrirTour = () => {
    if (vista === 'empresa') setTour('ficha')
    else if (vista === 'inicio') setTour('inicio')
    else if (vista === 'explorar') setTour('explorar')
    else if (vista === 'comparar') setTour('comparar')
    else if (vista === 'resultados') setTour('resultados')
    else if (vista === 'cuaderno' && arrancarTourCuaderno.current) arrancarTourCuaderno.current()
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

  // La empresa abierta ahora mismo (el tour de la ficha se arma con SUS datos)
  const empresaSel = tickerSel ? empresasData.empresas.find((x) => x.ticker === tickerSel) : null
  // Los pasos se memorizan: TourGuia mide el elemento de cada paso en un
  // efecto, y un array nuevo en cada render lo dispararía sin parar.
  const pasosTour = useMemo(() => {
    if (tour === 'ficha') return pasosFicha(empresaSel, nivel)
    if (tour === 'desbloqueo') return pasosDesbloqueo(empresaSel, nivel)
    if (tour === 'explorar') return PASOS_EXPLORAR
    if (tour === 'comparar') return PASOS_COMPARADOR
    if (tour === 'resultados') return PASOS_RESULTADOS
    return PASOS_INICIO
  }, [tour, empresaSel, nivel])

  const abrirEmpresa = (ticker, origen) => {
    setOrigenEmpresa(origen)
    // Cuenta las fichas vistas: con la primera ya se le puede ofrecer la
    // puerta de niveles del final (#135) — antes no, porque no sabría qué elige.
    marcarFichaVista()
    irA(`#/empresa/${ticker}`)
  }

  const empresaAleatoria = () => {
    const lista = empresasData.empresas
    const elegida = lista[Math.floor(Math.random() * lista.length)]
    abrirEmpresa(elegida.ticker, 'inicio')
  }

  /**
   * 🎓 Las salidas del graduado del plan. Las dos que llevan a analizar dejan
   * el 💡 Explícamelo ENCARGADO (pedirModoTocar): llega a la pantalla con los
   * bordes dorados encendidos y toca lo que no reconozca. Sin eso, alguien que
   * acaba de aprender el método aterriza en una ficha llena de números y la
   * ayuda vuelve a estar escondida detrás de un botón.
   * Devuelve true si se hizo cargo del destino.
   */
  const salidaDelPlan = (res) => {
    if (res.alAzarConAyuda) {
      pedirModoTocar('empresa')
      const lista = empresasData.empresas
      const elegida = lista[Math.floor(Math.random() * lista.length)]
      location.hash = `#/empresa/${elegida.ticker}`
      return true
    }
    if (res.explorar) {
      // El encargo apunta a la FICHA, no al explorador: ahí no hay nada con
      // borde dorado que tocar (cero `data-mentor`), así que encenderlo sería
      // un cartel señalando la nada. Queda esperando a que él elija empresa, y
      // el Explícamelo lo recibe en la ficha que haya escogido.
      pedirModoTocar('empresa')
      location.hash = '#/explorar'
      return true
    }
    return false
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

  // 🚪 Entrada (#135, Parte IV §29): ya NO es la puerta de niveles a secas.
  // 'bienvenida' → qué es esto + dos caminos · 'leccion' → las 5 tarjetas del
  // 🐣 (y sale en nivel 2, «Aprender») · 'niveles' → el selector de siempre,
  // para quien dijo que ya sabe. Sin nivel elegido no se ve nada más, como
  // antes: lo que cambió es la PREGUNTA que se hace primero.
  if (nivel == null) {
    return (
      <>
        <FondoVivo />
        <div className="aurora" aria-hidden="true" />
        {entrada === 'enganche' ? (
          <Enganche
            escalon={escalonEnganche}
            onSalir={() => setEntrada('bienvenida')}
            onFin={(res) => {
              setPlan(res)
              // Las salidas del diploma (una al azar con ayuda / buscarla yo
              // mismo) mandan el destino; acá solo queda fijar el nivel.
              if (salidaDelPlan(res)) { marcarLeccionVista(); setNivel(res.nivel); return }
              // «Mejor mírame esa empresa»: entra al nivel que le tocaba y va
              // derecho a la ficha del tema que SÍ reconoció. La lección queda
              // ofrecida en el inicio (cinta 🐣), no impuesta.
              if (res.verFicha) {
                marcarLeccionVista()
                location.hash = `#/empresa/${res.ficha.ticker}`
                setNivel(res.nivel)
                return
              }
              // Reconoce Y entiende: no se le hace repetir lo básico.
              if (res.saltaLeccion) { marcarLeccionVista(); setNivel(res.nivel); return }
              setEntrada('leccion')
            }}
          />
        ) : entrada === 'leccion' ? (
          <LeccionExpres
            retomar
            onFin={() => setNivel(plan?.nivel ?? 2)}
            onSaltar={() => setNivel(plan?.nivel ?? 2)}
            // ✕ / Esc: no es lo mismo que saltar. Vuelve a la bienvenida con lo
            // leído guardado, para que asomarse no cueste empezar de nuevo.
            onCerrar={() => setEntrada('bienvenida')}
            onAtras={() => setEntrada('bienvenida')}
          />
        ) : entrada === 'niveles' ? (
          <SelectorNivel onElegir={setNivel} onVolver={() => setEntrada('bienvenida')} />
        ) : (
          <Bienvenida
            // El 🐣 abre la conversación… salvo que haya dejado la lección a
            // medias: a ese no se le cambia el trato, se le devuelve su lugar.
            onNovato={(modo) => {
              setEscalonEnganche(modo === 'medias' ? 2 : 1)
              setEntrada(pasoLeccion() > 0 ? 'leccion' : 'enganche')
            }}
            onYaSe={() => setEntrada('niveles')}
            onMirar={() => setNivel(2)}
          />
        )}
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
                  data-tour={it.id === 'cuaderno' ? 'nav-cuaderno' : undefined}
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
            onLeccion={() => setLeccionAbierta(true)}
            // Desde el ☰ siempre abre la conversación, nunca la vista del
            // plan: si el usuario vio su plan hace un rato, ese `true` se
            // quedaba pegado y el menú le devolvía el cierre en vez de
            // preguntas nuevas.
            onEnganche={() => { setEngancheVerPlan(false); setEngancheAbierto(true) }}
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

            // 🎚️ El cierre de los primeros 5 minutos: la puerta de niveles
            // aparece AQUÍ, cuando ya sabe qué está eligiendo (#135).
            const bloquePuerta = puertaTardia ? (
              <PuertaTardia onElegir={setNivel} onCerrar={() => setPuertaTardia(false)} />
            ) : null

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
                  Valores de Lima que encajan contigo — para que las analices tú
                  mismo. Gratis y educativo.
                </p>
                {/* 🎣 Gancho de curiosidad con datos REALES (niveles 1-2): una
                    prueba viva de lo que hay adentro, antes de pedir el quiz */}
                {nivel <= 2 && <GanchoDatos onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />}
                {/* Un solo protagonista (el quiz); el resto son atajos discretos.
                    Atlas salió de aquí: ya está en la barra de arriba Y en el ☰,
                    y repetir un destino tres veces no lo hace más visible. */}
                <div className="hero-actions">
                  <button className="btn btn-oro" onClick={() => irA('#/quiz')}>
                    🎯 Empezar el quiz
                  </button>
                </div>
                <div className="hero-atajos">
                  <button onClick={() => irA('#/explorar')}>
                    🔎 Explorar las {empresasData.empresas.length}
                  </button>
                  <button onClick={empresaAleatoria}>🎲 Una al azar</button>
                  <button onClick={() => irA('#/glosario')}>📖 Glosario</button>
                </div>
              </div>
            )

            // 🎓 APRENDER: el plan y la lección, juntos. Antes estaban en las
            // dos puntas de la página (el plan arriba del hero, la lección al
            // final) y eran lo mismo — el camino del que recién llega — pero
            // separados por toda la pantalla. Solo para niveles 1-2: del 3 en
            // adelante siguen en el ☰, sin meterle ruido al que ya analiza.
            const bloqueAprender = nivel <= 2 && (
              <SeccionInicio
                id="aprender"
                icono="🎓"
                titulo="Empieza por aquí"
                resumen="tu plan y la lección exprés"
              >
                <PlanInversor
                  onAbrir={() => { setEngancheVerPlan(false); setEngancheAbierto(true) }}
                  onVerPlan={() => { setEngancheVerPlan(true); setEngancheAbierto(true) }}
                />
                <RepasoLeccion onAbrir={() => setLeccionAbierta(true)} />
              </SeccionInicio>
            )

            // 📓 LO TUYO: tu cuaderno y tu lista con ★. Es lo único de esta
            // pantalla que habla de TI, así que va junto y va arriba del mercado.
            const bloqueTuyo = (
              <SeccionInicio
                id="tuyo"
                icono="📓"
                titulo="Lo tuyo"
                resumen="tu cuaderno y tu lista para estudiar"
              >
                <CuadernoPortada onAbrir={() => irA('#/cuaderno')} />
                <MiLista onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
              </SeccionInicio>
            )

            // 📊 EL MERCADO HOY: el cierre de la BVL y la empresa del día.
            // Arranca CERRADO en los niveles 1-2 — el que recién llega no sabe
            // aún qué hacer con «subieron 12, bajaron 9», y ese cuadro entre él
            // y la lección es ruido. Del 3 en adelante arranca abierto: eso es
            // justamente lo que venía a mirar.
            const bloqueMercado = (
              <SeccionInicio
                // key con el nivel: si sube al 3 sin recargar, esta sección
                // vuelve a preguntarse si le toca estar abierta. Lo que el
                // usuario haya decidido a mano sigue mandando (vive en
                // localStorage, no en el estado que el key resetea).
                key={`mercado-${nivel}`}
                id="mercado"
                icono="📊"
                titulo="El mercado hoy"
                resumen="cómo cerró la BVL y la empresa del día"
                abiertaPorDefecto={nivel >= 3}
              >
                <HoyBVL onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                <EmpresaDelDia onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
              </SeccionInicio>
            )

            // Orden según el público: niveles 1-2 entran a APRENDER (hero al
            // frente); niveles 3-4 entran a TRABAJAR (buscador y mercado primero,
            // el hero con su moneda queda abajo).
            return (
              <div>
                {/* 📟 La cinta bursátil: el mercado late apenas entras (todos los niveles) */}
                <CintaBVL onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                {bloquePuerta}
                {nivel >= 3 ? (
                  <>
                    <BuscadorInicio onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                    {bloqueTuyo}
                    {bloqueMercado}
                    {bloqueHero}
                  </>
                ) : (
                  <>
                    {bloqueHero}
                    {bloqueAprender}
                    <BuscadorInicio onVerEmpresa={(t) => abrirEmpresa(t, 'inicio')} />
                    {bloqueTuyo}
                    {bloqueMercado}
                  </>
                )}
                {/* 🆕 Las novedades de la app bajan al pie: son sobre ALTO, no
                    sobre la bolsa — interesan cuando ya viste lo que viniste a
                    ver, no antes. */}
                {bloqueActualizaciones}
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

          {vista === 'cuaderno' && (
            <Cuaderno
              onVerEmpresa={(t) => abrirEmpresa(t, 'cuaderno')}
              onRegistrarTour={(fn) => { arrancarTourCuaderno.current = fn }}
            />
          )}

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

      {/* 🎓 EL MENTOR ALTO (#151): el ÚNICO flotante de aprendizaje. Absorbió
          la burbuja ❓ — el tour pasó a ser una de sus opciones — y suma el
          modo 👆 tocar, el "🤔 no entendí" de la sección donde está parado y
          el progreso ✔. key={vista}: al cambiar de pantalla se remonta y
          re-lee su saludo (si no, el del inicio se queda pegado). */}
      {tour == null && transicion == null && oferta == null
        && ['inicio', 'empresa', 'cuaderno', 'explorar', 'comparar', 'resultados'].includes(vista) && (
        <MentorALTO
          key={vista}
          vista={vista}
          nivel={nivel ?? 2}
          empresa={vista === 'empresa' ? empresaSel : null}
          onTour={abrirTour}
          onAtlas={() => irA('#/ia')}
        />
      )}
      {/* ✨ La oferta del tour de desbloqueo, cuando la transición ya terminó */}
      {oferta != null && transicion == null && vista === 'empresa' && tickerSel && (
        <OfertaDesbloqueo
          ticker={tickerSel}
          nivel={oferta}
          onAceptar={() => { setOferta(null); setTour('desbloqueo') }}
          onCerrar={() => setOferta(null)}
        />
      )}
      {tour != null && (
        <TourGuia
          pasos={pasosTour}
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

      {/* 🐣 Lección exprés reabierta desde el ☰ (el nivel ya está elegido: aquí
          solo se lee y se cierra, no se toca nada). */}
      {leccionAbierta && (
        <LeccionExpres
          // Quien la dejó a medias la retoma donde iba (es lo que le promete la
          // cinta 🐣 del inicio); quien ya la terminó y vuelve a mirarla,
          // empieza de la primera — ahí no hay nada que retomar.
          retomar={!leccionVista()}
          onFin={() => setLeccionAbierta(false)}
          onCerrar={() => setLeccionAbierta(false)}
        />
      )}

      {/* 🎣 El enganche reabierto desde el ☰. Diferencia con la entrada: acá el
          usuario YA eligió nivel, así que su cierre no lo cambia a la fuerza —
          solo ofrece la ficha del tema que reconoció. Cambiar de nivel sin
          pedirlo, a alguien que ya está adentro, sería quitarle el volante. */}
      {engancheAbierto && (
        <Enganche
          repaso
          verPlan={engancheVerPlan}
          onSalir={() => setEngancheAbierto(false)}
          onFin={(res) => {
            setEngancheAbierto(false)
            if (res.subirNivel && res.nivel) setNivel(res.nivel)
            if (salidaDelPlan(res)) return
            if (res.verFicha) { location.hash = `#/empresa/${res.ficha.ticker}`; return }
          }}
        />
      )}

      <footer className="footer">
        {config.marca.nombre} · {config.marca.subtitulo}
        <br />
        Contenido educativo · no es recomendación de inversión · el mercado manda.
      </footer>
    </>
  )
}
