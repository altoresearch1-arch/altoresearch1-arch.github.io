import { useEffect, useMemo, useState } from 'react'
import {
  nuevaConversacion, siguientePregunta, anotar, rutaFinal, guardarEnganche,
  categoria, paso as pasoDelPlan, rondaDeRefuerzo, hayBancoPara,
  senalSuficiente, tocaRespiro, fichaDeCat, voz, frase,
  tonoDeCat, pasosDominados, progresoPlan,
  ECOS, ANGULOS, NO_CONOCE, A_MEDIAS, POSPUESTO, DOMINA, RESPIRO, PUENTES, HONDURAS,
  TEMAS_POR_RONDA, TOTAL_BANCO, PLAN, CIERRES, GRADUACION,
} from '../lib/enganche'
import { cling, tunk } from '../lib/sonido'
import { NIVELES, colorNivel } from '../lib/nivel'

// ─────────────────────────────────────────────────────────────────────────
// 🗣️ LA CONVERSACIÓN DE ENTRADA (pedido de Jair, 24-jul · rediseñada 25-jul)
// Lo que había antes: tres pantallas iguales por tema (¿te suena? → pregunta →
// explicación), siempre en el mismo orden, con un «Pregunta 3 de 8» arriba.
// Eso es un cuestionario aunque el texto sea cálido: el usuario contesta ocho
// veces lo mismo y la app nunca reacciona distinto.
//
// Lo que hay ahora: el turno se ARMA con la respuesta anterior. No hay una
// secuencia; hay caminos, y cada uno existe porque cambia lo que pasa después:
//
//   «No, ¿qué es?»                → se DEJA de preguntar (regla 2). Se ofrece
//                                    la explicación en 30 segundos, adivinar
//                                    igual, o dejarlo para después sin costo.
//   «Más o menos, nunca entendí»  → UNA pregunta (regla 3): qué parte no le
//                                    cuadró. Con esa respuesta se arma la
//                                    explicación — tres ángulos, tres textos.
//   «Sí, ya lo conozco» + acierta → cero explicación básica (regla 4): o baja
//                                    más hondo en el mismo tema, o cambia.
//
// Y dos progresiones que se ven, no se anuncian:
//   ↕️ VERTICAL — la cadena («el celular que tienes en la mano… → el cerro») y
//      el «dame una más difícil»: se profundiza en el mismo sitio.
//   ↔️ LATERAL — el rastro de arriba y el «cambiemos de tema»: se cruza
//      terreno nuevo. Al final se le dice por cuántos territorios pasó.
//
// Reglas de tono, no negociables:
//   · «No sé» y «no lo conozco» son respuestas dignas: nunca dicen
//     «incorrecto» y la explicación llega igual de completa.
//   · Posponer no castiga: no resta, no baja de nivel, queda esperando.
//   · Se puede salir en cualquier momento sin sermón. Nadie está atrapado.
// ─────────────────────────────────────────────────────────────────────────

// ↕️ Las tres honduras, en el orden en que se baja. El índice es el peldaño.
const ESCALERA = HONDURAS.map((h) => h.id)
const peldanoDe = (p, escalon) => {
  const i = ESCALERA.indexOf(p?.tipo)
  return i >= 0 ? i + 1 : Math.min(3, Math.max(1, escalon || 1))
}

// Jair escribe los ganchos de las dos formas (unos ya vienen con «comillas»
// porque son una cita literal, otros no). La pantalla las pone SIEMPRE, así que
// primero se las quita: si no, salen dobles («« »»).
const sinComillas = (s) => String(s).replace(/^[«"“'\s]+|[»"”'\s]+$/g, '')

// El «No sé» del JSON, dicho como lo diría una persona (regla 6). Se cambia
// acá y no en las 152 preguntas: el dato es el mismo, el tono es de la pantalla.
const TXT_NS = 'Ni idea — dímelo tú'

const ETIQUETA_ECO = {
  tiktok: '📱 Esto circula en TikTok e Instagram',
  noticias: '📺 Esto salió en las noticias',
  familia: '🏠 Esto se dice en las casas',
  calle: '🗣️ Esto se escucha en la calle',
}

export default function Enganche({ onFin, onSalir, repaso = false, total = TEMAS_POR_RONDA, escalon = 1, verPlan = false }) {
  // 📋 Volver con pasos pendientes NO es empezar de nuevo: la ronda se recorta
  // a los módulos que faltan (pedido de Jair, 25-jul). Si volviera a preguntar
  // de todo, el que ya tiene 6 de 8 se pasaría media conversación demostrando
  // lo que ya demostró. Solo aplica al que ya empezó: con el plan vacío faltan
  // los ocho, y recortar a «los ocho» no recorta nada.
  const [estado, setEstado] = useState(() => {
    const prog = progresoPlan()
    const enfoca = repaso && prog.ganados > 0 && !prog.completo
    return nuevaConversacion(total, { escalon, pasos: enfoca ? prog.faltan : undefined })
  })
  // `verPlan` entra directo al cierre con lo que ya tiene ganado: es «ver mi
  // plan» desde el inicio, sin obligar a contestar nada primero. Funciona
  // porque rutaFinal ya lee de localStorage los pasos ganados y con qué
  // pregunta los ganó — una conversación vacía basta para armarlo.
  // intro · cadena · sonda · oferta · duda · pregunta · clase · bombillo · respiro · final
  const [paso, setPaso] = useState(verPlan ? 'final' : 'intro')
  const [pregunta, setPregunta] = useState(null)
  const [eco, setEco] = useState(null)
  const [via, setVia] = useState('sonda')        // cómo llegó a la pregunta
  const [angElegido, setAngElegido] = useState(null)
  const [elegida, setElegida] = useState(null)   // índice de la opción marcada
  const [aviso, setAviso] = useState(null)       // la línea corta del mentor arriba de la tarjeta
  const [resultado, setResultado] = useState(() =>
    verPlan ? rutaFinal(nuevaConversacion(total, { escalon })) : null)
  // El respiro que toca ahora: { senal: 'cero'|'analisis'|null }. `senalDada`
  // recuerda cuál ya se ofreció — «creo que ya te entendí» dicho dos veces
  // deja de ser una conclusión y pasa a ser una cantaleta.
  const [respiro, setRespiro] = useState(null)
  const [senalDada, setSenalDada] = useState(null)
  // La ruta se decide en la PRIMERA ronda. Una segunda vuelta sirve para
  // completar el plan, no para degradarlo: sería absurdo que practicar lo que
  // te falta te mande a un nivel más bajo que antes de practicarlo.
  const [rutaBase, setRutaBase] = useState(null)

  const nHechas = estado.respuestas.length
  const nNunca = estado.respuestas.filter((r) => r.eco === 'nunca').length

  // En el JSON la correcta se escribe SIEMPRE primera (así Jair la edita sin
  // contar posiciones), pero mostrarlas en ese orden convertía la conversación
  // en un truco de dos segundos: «siempre es la A». Se barajan al vuelo y el
  // «Ni idea» se queda al final, que es su lugar natural en una lista.
  const opciones = useMemo(() => {
    if (!pregunta) return []
    const reales = pregunta.opciones.filter((o) => !o.ns)
    const noSe = pregunta.opciones.filter((o) => o.ns)
    for (let i = reales.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[reales[i], reales[j]] = [reales[j], reales[i]]
    }
    return [...reales, ...noSe]
  }, [pregunta])
  const correcta = pregunta?.opciones.find((o) => o.ok)?.t

  // 🔗 Cuántos eslabones de la cadena están a la vista (progresión VERTICAL:
  // se baja de tu bolsillo hasta el cerro, uno por uno, y cada bajada la pide
  // el usuario tocando la pregunta que él mismo haría).
  const [eslabones, setEslabones] = useState(0)

  // ↕️ El peldaño más hondo al que llegó hoy. Solo sube: ver bajar la escalera
  // por haber fallado es el castigo que esta pantalla promete no hacer.
  const [hondura, setHondura] = useState(escalon)
  // Hacia dónde se movió el último turno. Decide de dónde ENTRA la tarjeta:
  // desde abajo si bajamos de profundidad, desde el costado si cambiamos de
  // terreno. El movimiento dice lo mismo que el texto, medio segundo antes.
  const [dir, setDir] = useState(null)
  // ¿Esta ronda debe cortarse al llenar el plan? Sí, salvo que haya arrancado
  // con el plan YA lleno («hacerlo otra vez por gusto»): ahí cortar al primer
  // turno sería devolverle el diploma en la cara apenas conteste una.
  const [cortaAlLlenar, setCortaAlLlenar] = useState(() => !progresoPlan().completo)
  // 🎚️ Con qué nivel va a salir de acá. Arranca en el recomendado (el 3: su
  // frase en el selector es «ya sé lo básico», que es justo lo que acaba de
  // demostrar), pero el diploma muestra los cuatro con lo que abre cada uno y
  // él decide. Elegir sin saber qué hay detrás no es elegir.
  const [nivelElegido, setNivelElegido] = useState(GRADUACION.nivel)

  // Abrir un tema. `directo` lo lleva a la pregunta sin pasar por el «¿te
  // suena?»: es para cuando el propio usuario pidió que lo prueben — volver a
  // preguntarle si le suena sería no haberlo escuchado.
  const abrir = (p, opts = {}) => {
    setPregunta(p); setEco(null); setElegida(null); setAngElegido(null)
    setVia(opts.directo ? 'prueba' : 'sonda')
    setEslabones(1)
    setHondura((h) => Math.max(h, peldanoDe(p, estado.escalon)))
    setDir(opts.masHondo ? 'hondo' : p?.cat !== estado.ultimaCat ? 'lateral' : null)
    setPaso(opts.directo ? 'pregunta' : p?.eslabones ? 'cadena' : 'sonda')
  }

  const arrancar = () => abrir(siguientePregunta(estado))

  // Esc = salir. Es una conversación, no una jaula.
  useEffect(() => {
    const al = (e) => { if (e.key === 'Escape' && onSalir) onSalir() }
    window.addEventListener('keydown', al)
    return () => window.removeEventListener('keydown', al)
  }, [onSalir])

  // Cierra la ronda: calcula el plan, conserva la ruta de la primera vuelta y
  // guarda. Es el mismo camino tanto si terminó los 8 temas como si cortó.
  const cerrarRonda = (est) => {
    const crudo = rutaFinal(est)
    let res = rutaBase ? { ...crudo, ...rutaBase } : crudo
    // La ronda de refuerzo no puede BAJARLE la ruta… pero sí subírsela: si
    // completó los 8 pasos del método, mandarlo igual a la clase introductoria
    // sería contradecir lo que la propia app le acaba de reconocer. (Al que no
    // reconoce nada de nada se le respeta la ruta `cero`: le falta el
    // vocabulario, no el razonamiento, y eso lo da la lección.)
    if (res.planCompleto && res.ruta === 'basico') {
      res = { ...res, ruta: 'analisis', nivel: 3, saltaLeccion: true }
    }
    if (!rutaBase) {
      setRutaBase({
        ruta: crudo.ruta, nivel: crudo.nivel,
        saltaLeccion: crudo.saltaLeccion, ficha: crudo.ficha,
      })
    }
    guardarEnganche(res, est)
    setEstado(est); setResultado(res); setPaso('final')
  }

  /**
   * Cierra el tema actual y decide el siguiente turno. Es el único sitio donde
   * se avanza, y por eso es donde viven las reglas: cada tanto se para a
   * preguntar cómo va (respiro), y si ya entendimos a la persona se le ofrece
   * salir en vez de hacerle completar la ronda por completarla.
   */
  const avanzar = (datos, opts = {}) => {
    const nuevo = anotar(estado, pregunta, datos)
    setEstado(nuevo)

    // 🪡 La costura entre un tema y el siguiente. Sin ella la conversación se
    // corta en seco cada vez que se cambia de pregunta, y ese silencio es lo
    // que hace que ocho turnos se sientan un formulario de ocho campos.
    const recibio = datos.via === 'clase' || datos.via === 'duda'
    const pool = opts.masHondo ? PUENTES.hondo
      : opts.otroTema ? PUENTES.lateral
      : recibio ? PUENTES.clase
      : datos.acerto ? PUENTES.acerto
      : datos.via === 'sonda' || datos.via === 'prueba' ? PUENTES.falla
      : null
    setAviso(opts.aviso ?? (pool ? frase(pool, nHechas) : null))

    // 🎓 Si con esta respuesta se completaron los 8 pasos, la ronda se CORTA
    // acá mismo (pedido de Jair, 25-jul). Seguir preguntando después de que el
    // plan está lleno sería cobrarle preguntas de más por haber terminado: el
    // objetivo era el plan, y el plan ya está.
    if (cortaAlLlenar && PLAN.every((p) => pasosDominados(nuevo).has(p.id))) {
      cerrarRonda(nuevo); return
    }

    if (nuevo.respuestas.length >= nuevo.total) { cerrarRonda(nuevo); return }
    if (!opts.sinRespiro) {
      const s = senalSuficiente(nuevo)
      if (s && s !== senalDada) { setSenalDada(s); setRespiro({ senal: s }); setPaso('respiro'); return }
      if (tocaRespiro(nuevo)) { setRespiro({ senal: null }); setPaso('respiro'); return }
    }

    const p = siguientePregunta(nuevo, opts)
    if (!p) { cerrarRonda(nuevo); return }
    // Pidió «más de esto mismo» y el motor tuvo que mudarlo de tema porque en
    // ese ya no le quedaba nada por ganar. Se le explica: cambiar de sitio sin
    // decir nada es justo lo que hace sentir que la app no te escucha.
    if (opts.masHondo && p.cat !== pregunta.cat) {
      setAviso(frase(PUENTES.hondoOtro, nHechas))
    }
    abrir(p, opts)
  }

  // ── Las respuestas del usuario, una por camino ──────────────────────────

  const responderEco = (id) => {
    setEco(id); setAviso(null)
    // Regla 2: si no lo conoce, se DEJA de preguntar. Regla 3: si lo sabe a
    // medias, una sola pregunta. Regla 4: si lo conoce, derecho a probarse.
    setPaso(id === 'nunca' ? 'oferta' : id === 'vago' ? 'duda' : 'pregunta')
  }

  const responder = (i) => {
    const op = opciones[i]
    setElegida(i); setAviso(null)
    // El cling de la moneda del inicio: el mismo de siempre, a propósito.
    // Fallar suena distinto (tunk) pero no suena a error: suena a «sigue».
    if (op.ok) cling(); else if (!op.ns) tunk()
    setPaso('bombillo')
  }

  // 🔁 «Otra ronda, solo de lo que me falta»: misma conversación, banco
  // recortado a los pasos del plan que todavía no domina.
  const otraRonda = (pasos) => {
    const est = rondaDeRefuerzo(pasos)
    const p = siguientePregunta(est)
    if (!p) return
    setCortaAlLlenar(true)
    setEstado(est); setResultado(null); setAviso(null); setSenalDada(null); abrir(p)
  }

  // 🔄 «Hacerlo otra vez, con otros ángulos» (del diploma). No es la ronda de
  // refuerzo: acá el banco entero vuelve a estar disponible y, como las
  // preguntas ya vistas se saltan mientras quede banco, el mismo plan se
  // recorre con casos nuevos. Ganar dos veces un paso no suma nada al plan,
  // así que esto es puro gusto — y por eso se ofrece, no se empuja.
  const repetirTodo = () => {
    const est = nuevaConversacion(TEMAS_POR_RONDA)
    const p = siguientePregunta(est)
    if (!p) return
    setCortaAlLlenar(false)
    setEstado(est); setResultado(null); setAviso(null); setSenalDada(null); abrir(p)
  }

  // Cortar a mitad TAMBIÉN cuenta: con lo respondido alcanza para rutear.
  // Irse no puede costarle al usuario volver a empezar de cero.
  const cortar = () => {
    if (!nHechas) { onSalir?.(); return }
    cerrarRonda(estado)
  }

  const acerto = elegida != null && !!opciones[elegida]?.ok
  const dijoNoSe = elegida != null && !!opciones[elegida]?.ns
  // Regla 4: al que dijo «ya lo conozco» y lo probó, o al que viene acertando,
  // no se le repite lo básico. Se le da el matiz y el timón.
  const yaLoDomina = acerto && (eco === 'vi' || estado.escalon >= 2 || via === 'prueba')
  const catActual = pregunta && categoria(pregunta.cat)
  const angulo = ANGULOS.find((a) => a.id === angElegido)

  // 📋 Los pasos del método que ya tiene ganados. Se calcula ANTES de anotar el
  // turno, así que el paso que acaba de acertar todavía no está: eso permite
  // encenderlo delante de sus ojos en la pantalla de la explicación.
  const ganados = useMemo(() => pasosDominados(estado), [estado])
  const ganaAhora = acerto && pregunta && !ganados.has(pregunta.paso)
  const nGanados = ganados.size + (ganaAhora ? 1 : 0)
  // Con esta respuesta se llenó el plan: la ronda se cortará y lo que sigue
  // es el diploma. La pantalla tiene que decirlo antes de que pase.
  const completaAhora = cortaAlLlenar && ganaAhora && nGanados >= PLAN.length
  const territorios = new Set(estado.respuestas.map((r) => r.cat)).size
  // La tarjeta entra desde abajo si bajamos de profundidad y desde el costado
  // si cruzamos de terreno. Solo en la PRIMERA tarjeta del tema: dentro de un
  // mismo tema el movimiento sería ruido.
  const entra = dir === 'hondo' ? ' entra-hondo' : dir === 'lateral' ? ' entra-lateral' : ''
  // Abierto con «ver mi plan»: hay cierre, pero no hubo ronda detrás.
  const soloPlan = paso === 'final' && estado.respuestas.length === 0

  return (
    // `repaso` es la conversación reabierta desde el ☰: ahí abajo hay una app
    // con texto, así que el velo se cierra. En la ENTRADA, en cambio, abajo
    // solo está la aurora y se la deja ver.
    <div
      className={'eng' + (repaso ? ' eng-sobre-app' : '')}
      style={pregunta ? { '--eng-tono': tonoDeCat(pregunta.cat) } : undefined}
    >
      {/* El aire del territorio: se rehace al cruzar de mundo (por eso la key
          es la categoría) y entra en fundido. Es la progresión lateral dicha
          con luz, medio segundo antes de que se lea el primer texto. */}
      {pregunta && <div className="eng-aire" key={pregunta.cat} aria-hidden="true" />}
      <div className="eng-inner">
        <div className="eng-cab">
          {/* Arriba ya NO dice «Pregunta 3 de 8»: eso es el encabezado de un
              examen. Dice por dónde vamos, que es lo que diría una persona. */}
          {/* El nombre de la cosa (pedido de Jair, 25-jul). «¿Qué has
              escuchado?» describía la mecánica; «Plan para nuevo inversor»
              dice para qué sirve, que es lo que hace que alguien la abra. */}
          <span className="kicker">
            {paso === 'intro' || paso === 'final' || paso === 'respiro'
              ? '📋 Plan para nuevo inversor'
              : estado.refuerzo
                ? '🔁 Completando tu plan'
                : catActual
                  ? `${catActual.icono} ${catActual.chip}`
                  : '📋 Plan para nuevo inversor'}
          </span>
          <div className="eng-cab-acciones">
            {paso !== 'final' && paso !== 'intro' && (
              <button className="eng-saltar" onClick={cortar}>Ya fue, entrar</button>
            )}
            {onSalir && (
              <button className="eng-cerrar" onClick={onSalir} aria-label="Cerrar" title="Cerrar (Esc)">✕</button>
            )}
          </div>
        </div>

        {/* ↔️ EL RASTRO (progresión LATERAL). Cada casilla contestada se queda
            con el ícono del tema por donde pasó, y los pospuestos con un ⏳ —
            porque «lo vemos después» tiene que verse como lo que es: algo que
            queda esperando, no una casilla en rojo. Es una sola línea: mostrar
            más sería convertirlo en tablero. */}
        {paso !== 'intro' && paso !== 'final' && (
          <>
            <div className="eng-progreso">
              <div className="eng-rastro" aria-hidden="true">
                {Array.from({ length: estado.total }).map((_, n) => {
                  const r = estado.respuestas[n]
                  return (
                    <span
                      key={n}
                      className={'eng-hito' + (r ? (r.pospuesto ? ' luego' : ' on') : n === nHechas ? ' hoy' : '')}
                      style={r && !r.pospuesto ? { '--hito-tono': tonoDeCat(r.cat) } : undefined}
                    >
                      {r ? (r.pospuesto ? '⏳' : categoria(r.cat)?.icono) : ''}
                    </span>
                  )
                })}
              </div>
              {/* ↕️ La escalera: tres peldaños que bajan. Va en vertical al
                  costado del rastro a propósito — las dos progresiones se leen
                  como lo que son, una cruza y la otra baja. */}
              <div
                className="eng-escalera"
                title={`Hasta dónde bajaste: ${HONDURAS[hondura - 1]?.txt}`}
                aria-label={`Profundidad: ${HONDURAS[hondura - 1]?.txt}`}
              >
                {HONDURAS.map((h, i) => (
                  <span key={h.id} className={'eng-peldano' + (i < hondura ? ' on' : '')} />
                ))}
              </div>
            </div>
            {/* La brújula: una línea que dice en voz baja por dónde va. Sin
                porcentajes ni «3 de 8»: eso es el encabezado de un examen. */}
            <p className="eng-brujula">
              <span className="eng-brujula-lat">
                ↔ {Math.max(1, territorios)} {territorios > 1 ? 'mundos' : 'mundo'}
              </span>
              <span className="eng-brujula-sep" aria-hidden="true">·</span>
              <span className="eng-brujula-ver">
                ↕ {HONDURAS[hondura - 1]?.icono} {HONDURAS[hondura - 1]?.txt}
              </span>
              {/* 📋 El contador del plan, SIEMPRE a la vista mientras conversa
                  (26-jul). El reclamo era exacto: «hice tres preguntas y sentí
                  que no avancé». Ahora cada paso ganado mueve este número
                  delante suyo, en la misma línea donde ya se ve el terreno y
                  la profundidad. */}
              <span className="eng-brujula-sep" aria-hidden="true">·</span>
              <span className="eng-brujula-plan">📋 {nGanados} de {PLAN.length}</span>
            </p>
          </>
        )}

        {/* La línea corta del mentor al abrir el siguiente tema («queda para
            después»). Va acá y no en una pantalla propia: una pantalla entera
            para decir «ok» es exactamente la sobrecarga que sacamos. */}
        {aviso && paso !== 'intro' && paso !== 'final' && (
          <p className="eng-aviso">{aviso}</p>
        )}

        {/* ── 0. La invitación. Aquí se promete lo que se va a cumplir: ─────
            no hay nota, no hay ranking, y se puede parar cuando sea. */}
        {paso === 'intro' && (
          <div className="eng-card eng-intro">
            <div className="eng-icono" aria-hidden="true">{repaso && ganados.size ? '📋' : '🎣'}</div>
            <h2 className="eng-titulo">
              {repaso && ganados.size >= PLAN.length
                ? 'Ya tienes el plan completo. ¿Seguimos por gusto?'
                : repaso && ganados.size
                  ? `Te faltan ${PLAN.length - ganados.size} pasos para completar tu plan`
                  : repaso
                    ? 'Tu plan para empezar a invertir, en 8 pasos'
                    : 'Antes de enseñarte nada, ALTO quiere escucharte'}
            </h2>
            <p className="eng-cuerpo">
              {repaso && ganados.size >= PLAN.length ? (
                <>
                  No te falta ningún paso. Lo que viene ahora es por gusto: temas distintos a los
                  que ya te salieron, para seguir estirando lo que ya sabes.
                </>
              ) : repaso && ganados.size ? (
                <>
                  Llevas <strong>{ganados.size} de {PLAN.length}</strong>. Seguimos con temas
                  distintos a los que ya te salieron, apuntando a lo que te falta.
                </>
              ) : repaso ? (
                <>
                  Seguimos la conversación con temas <strong>distintos</strong> a los que ya te
                  salieron. Titulares, frases de TikTok, cosas que se dicen en tu casa.
                </>
              ) : (
                <>
                  Te vamos a mostrar cosas que <strong>ya escuchaste</strong> por ahí: un titular
                  del noticiero, algo de TikTok, una frase de la mesa de tu casa. Tú dices si te
                  suena y qué crees que significa.
                </>
              )}
            </p>
            <ul className="eng-promesas">
              <li><span aria-hidden="true">🚫</span> No hay nota, ni ranking, ni respuesta que te deje mal.</li>
              <li><span aria-hidden="true">🤷</span> Si algo no lo conoces, te lo explico y seguimos. Sin vueltas.</li>
              <li><span aria-hidden="true">⏳</span> Lo que no quieras ver ahora, lo dejas para después. No resta.</li>
              <li><span aria-hidden="true">📋</span> Al final te queda un <strong>plan de 8 pasos</strong> para mirar cualquier empresa.</li>
            </ul>
            <p className="eng-pie">
              Dura lo que tú quieras y la cortas cuando quieras. Hay {TOTAL_BANCO} temas en el
              banco, así que nunca te va a salir lo mismo dos veces.
            </p>
            <div className="eng-nav">
              <button className="btn" onClick={arrancar}>Dale, empecemos →</button>
            </div>
          </div>
        )}

        {/* ── 1b. LA CADENA (progresión VERTICAL) ─────────────────────────
            Arranca en algo que la persona tiene en la mano y baja hasta el
            cerro. Cada eslabón lo pide ella tocando su propia curiosidad
            («¿y de dónde sale eso?»). Da antes de pedir: por eso es el turno
            que el motor elige cuando lleva dos preguntas seguidas. */}
        {paso === 'cadena' && pregunta && (
          <div className={'eng-card eng-cadena' + entra} key={pregunta.id + '-c'}>
            <p className="eng-cadena-arranque">{sinComillas(pregunta.gancho)}</p>
            <div className="eng-cadena-hilo">
              {pregunta.eslabones.slice(0, eslabones).map((e, i) => (
                <p className="eng-cadena-eslabon" key={i}>{e.txt}</p>
              ))}
            </div>
            {/* El botón NO dice «siguiente»: dice la pregunta que la persona ya
                se está haciendo. Por eso avanzar se siente propio y no guiado. */}
            <button
              className="btn eng-cadena-btn"
              onClick={() => {
                if (eslabones < pregunta.eslabones.length) setEslabones(eslabones + 1)
                else setPaso('pregunta')
              }}
            >
              {pregunta.eslabones[Math.min(eslabones, pregunta.eslabones.length) - 1].sigue}
            </button>
          </div>
        )}

        {/* ── 1. LA SONDA: «esto lo viste» → ¿te suena? ───────────────────
            Es la única pregunta de la app que no busca que aciertes nada, y
            existe porque sus tres respuestas llevan a tres sitios distintos:
            explicación, una sola pregunta, o derecho a probarse. */}
        {paso === 'sonda' && pregunta && (
          <div className={'eng-card' + entra} key={pregunta.id + '-g'}>
            <div className="eng-eco-marco">
              <span className="eng-eco-etiqueta">{ETIQUETA_ECO[pregunta.eco] ?? ETIQUETA_ECO.calle}</span>
              <p className="eng-gancho">«{sinComillas(pregunta.gancho)}»</p>
            </div>
            <p className="eng-pregunta-eco">{voz(pregunta.eco)}</p>
            <div className="eng-opciones">
              {ECOS.map((e) => (
                <button key={e.id} className="eng-opcion eng-opcion-eco" onClick={() => responderEco(e.id)}>
                  <span className="eng-opcion-txt">{e.txt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 2a. NO LO CONOCE (regla 2) ──────────────────────────────────
            Acá NO va otra pregunta de comprensión. Preguntarle qué significa
            algo que acaba de decir que no conoce es el momento exacto en que
            una app deja de ser mentor y se vuelve examinador. Se le ofrece
            una salida, y las tres son buenas. */}
        {paso === 'oferta' && pregunta && (
          <div className="eng-card" key={pregunta.id + '-o'}>
            <p className="eng-gancho-mini">«{sinComillas(pregunta.gancho)}»</p>
            <h2 className="eng-titulo">{frase(NO_CONOCE.entradas, nHechas)}</h2>
            <p className="eng-cuerpo">{NO_CONOCE.cuerpo(nNunca)}</p>
            <div className="eng-opciones">
              {NO_CONOCE.opciones.map((o) => (
                <button
                  key={o.id}
                  className={'eng-opcion' + (o.id === 'luego' ? ' eng-opcion-suave' : '')}
                  onClick={() => {
                    if (o.id === 'clase') { setPaso('clase'); return }
                    if (o.id === 'adivinar') { setPaso('pregunta'); return }
                    // «Lo vemos más adelante»: no resta, no reprueba, y se
                    // cambia de tema —seguir en el mismo sería no haberle
                    // hecho caso. El mentor lo dice en una línea, no en una
                    // pantalla de despedida.
                    avanzar(
                      { eco, via: 'pospuesto' },
                      { otroTema: true, sinRespiro: true, aviso: frase(POSPUESTO, nHechas) },
                    )
                  }}
                >
                  <span className="eng-opcion-txt">{o.txt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 2b. LO SABE A MEDIAS (regla 3) ──────────────────────────────
            UNA pregunta, y no es de comprensión: es «¿dónde se te traba?».
            La respuesta arma la explicación (tres ángulos, tres textos
            distintos), así que no es información que se recoge — es
            información que se usa en la pantalla siguiente. */}
        {paso === 'duda' && pregunta && (
          <div className="eng-card" key={pregunta.id + '-d'}>
            <p className="eng-gancho-mini">«{sinComillas(pregunta.gancho)}»</p>
            <h2 className="eng-titulo">{frase(A_MEDIAS.entradas, nHechas)}</h2>
            <p className="eng-pregunta-eco">{A_MEDIAS.pregunta}</p>
            <div className="eng-opciones">
              {ANGULOS.map((a) => (
                <button
                  key={a.id}
                  className="eng-opcion eng-opcion-eco"
                  onClick={() => { setAngElegido(a.id); setPaso('bombillo') }}
                >
                  <span className="eng-opcion-txt">{a.txt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. LA PREGUNTA de comprensión ───────────────────────────────
            Solo llega acá quien dijo que lo conoce, quien quiso adivinar, o
            quien pidió que lo prueben. A nadie se le toma examen de algo que
            acaba de decir que no sabe. */}
        {paso === 'pregunta' && pregunta && (
          <div className={'eng-card' + (via === 'prueba' ? entra : '')} key={pregunta.id + '-p'}>
            {/* Dos voces, y se ven como dos voces (26-jul, pedido de Jair):
                arriba lo que ÉL escuchó, entre comillas y con su borde; abajo
                lo que le pregunto yo, en grande y del color del territorio.
                Antes la frase suya era una línea gris de 13 px encima del
                enunciado: parecía el pie de una diapositiva, no una
                conversación entre dos. */}
            <div className="eng-dialogo">
              <span className="eng-dialogo-etq">Tú escuchaste esto</span>
              <p className="eng-dialogo-tuyo">«{sinComillas(pregunta.gancho)}»</p>
            </div>
            <span className="eng-dialogo-etq eng-etq-yo">Y yo te pregunto</span>
            <h2 className="eng-titulo eng-titulo-grande">{pregunta.pregunta}</h2>
            {via === 'prueba' && (
              <p className="eng-guino">Esta la pediste tú, a ver cómo te va.</p>
            )}
            {via !== 'prueba' && eco === 'nunca' && (
              <p className="eng-guino">No lo conocías, así que tira nomás. Si le pegas, mérito doble.</p>
            )}
            <div className="eng-opciones">
              {opciones.map((o, i) => (
                <button
                  key={i}
                  className={'eng-opcion' + (o.ns ? ' eng-opcion-ns' : '')}
                  onClick={() => responder(i)}
                >
                  <span className="eng-letra" aria-hidden="true">{o.ns ? '🤷' : 'ABC'[i]}</span>
                  <span className="eng-opcion-txt">{o.ns ? TXT_NS : o.t}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 4a. LA MINI CLASE: lo pidió él, así que no hay examen ──────── */}
        {paso === 'clase' && pregunta && (
          <div className="eng-card eng-bombillo" key={pregunta.id + '-cl'}>
            <div className="eng-veredicto"><span aria-hidden="true">🎓</span> Va, en 30 segundos.</div>
            <p className="eng-clase-tema">{pregunta.pregunta}</p>
            <p className="eng-correcta"><strong>{correcta}</strong></p>
            <p className="eng-cuerpo">{pregunta.explica}</p>
            {pregunta.puente && (
              <p className="eng-puente"><span aria-hidden="true">🔗</span> {pregunta.puente}</p>
            )}
            <div className="eng-nav eng-nav-doble">
              {/* Curiosidad, no obligación: el que quiere usar lo que acaba de
                  aprender lo usa YA, en otra del mismo tema. El que no, sigue. */}
              <button
                className="btn btn-fantasma"
                onClick={() => avanzar({ eco, via: 'clase' }, { masHondo: true, directo: true, sinRespiro: true })}
              >
                Pruébame con eso →
              </button>
              <button className="btn" onClick={() => avanzar({ eco, via: 'clase' })}>
                Listo, sigamos →
              </button>
            </div>
          </div>
        )}

        {/* ── 4b. EL BOMBILLO: la explicación ─────────────────────────────
            Tres versiones, y la diferencia no es cosmética:
            · el que ya lo domina NO ve lo básico (regla 4): ve el matiz y elige
              si baja más hondo o cambia de tema;
            · el que dijo dónde se le trababa ve PRIMERO esa parte (regla 3);
            · el resto ve la explicación completa, haya acertado o no. */}
        {paso === 'bombillo' && pregunta && (
          <div className="eng-card eng-bombillo" key={pregunta.id + '-b'}>
            {angElegido ? (
              <>
                {/* Regla 3: la explicación se arma con lo que él dijo que no
                    le cuadraba, y arranca por ahí. */}
                <div className="eng-veredicto"><span aria-hidden="true">💡</span> {angulo?.cabecera}</div>
                {angElegido === 'palabra' && (
                  <>
                    <p className="eng-correcta"><strong>{correcta}</strong></p>
                    <p className="eng-cuerpo">{pregunta.explica}</p>
                  </>
                )}
                {angElegido === 'mecanismo' && (
                  <>
                    <p className="eng-cuerpo">{pregunta.explica}</p>
                    {/* El puente sube de nota al pie: para el que pregunta «¿y
                        por qué eso mueve plata?», la línea que lo aterriza en
                        la caja de una empresa ES la respuesta, no el adorno.
                        (Sin repetir el título del paso: eso lo dice la
                        etiqueta de abajo, y decirlo dos veces seguidas es lo
                        que hace que un texto suene generado.) */}
                    {pregunta.puente && (
                      <p className="eng-cuerpo eng-mecanismo">{pregunta.puente}</p>
                    )}
                  </>
                )}
                {angElegido === 'yo' && (
                  <>
                    {pregunta.puente && <p className="eng-cuerpo">{pregunta.puente}</p>}
                    <p className="eng-puente">
                      <span aria-hidden="true">🇵🇪</span> Aterrizado: <strong>{fichaDeCat(pregunta.cat).nombre}</strong>{' '}
                      {fichaDeCat(pregunta.cat).porque} — está en ALTO con sus números.
                    </p>
                    <p className="eng-cuerpo">{pregunta.explica}</p>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="eng-veredicto">
                  {acerto ? (
                    <><span aria-hidden="true">💡</span> {frase(DOMINA.veredictos, nHechas)}</>
                  ) : dijoNoSe ? (
                    <><span aria-hidden="true">💡</span> Perfecto: para eso estamos.</>
                  ) : (
                    <><span aria-hidden="true">💡</span> Casi. Mira:</>
                  )}
                </div>
                {!acerto && <p className="eng-correcta"><strong>{correcta}</strong></p>}
                {/* Regla 4: al que ya lo demostró no se le explica lo que
                    acaba de probar que sabe. Se le da el matiz y nada más. */}
                {yaLoDomina ? (
                  pregunta.puente && (
                    <p className="eng-puente"><span aria-hidden="true">🔗</span> {pregunta.puente}</p>
                  )
                ) : (
                  <>
                    <p className="eng-cuerpo">{pregunta.explica}</p>
                    {pregunta.puente && (
                      <p className="eng-puente"><span aria-hidden="true">🔗</span> {pregunta.puente}</p>
                    )}
                  </>
                )}
              </>
            )}

            {/* 📋 El hilo con el plan: este tema no era suelto, entrenaba UNO
                de los ocho pasos. Decirlo acá (y no solo al final) es lo que
                hace que el listado del cierre se sienta ganado. */}
            <p className="eng-paso-tag">
              <span aria-hidden="true">{pasoDelPlan(pregunta.paso)?.icono}</span>
              Esto era el paso {PLAN.findIndex((p) => p.id === pregunta.paso) + 1} de 8:{' '}
              <strong>{pasoDelPlan(pregunta.paso)?.titulo}</strong>
            </p>

            {/* 🧱 EL MÉTODO QUE SE LLENA A LA VISTA. Antes el plan aparecía
                recién al final, así que durante la conversación no se sentía
                que las respuestas construyeran nada. Ahora la casilla se
                enciende delante suyo en el mismo segundo en que la gana: ocho
                ladrillos que se van poniendo, no un puntaje. */}
            <div className="eng-metodo">
              <div className="eng-metodo-fila" aria-hidden="true">
                {PLAN.map((p) => {
                  const tiene = ganados.has(p.id)
                  const nuevo = ganaAhora && p.id === pregunta.paso
                  return (
                    <span
                      key={p.id}
                      className={'eng-ladrillo' + (tiene || nuevo ? ' on' : '') + (nuevo ? ' nuevo' : '')}
                      title={p.titulo}
                    >
                      {tiene || nuevo ? p.icono : ''}
                    </span>
                  )
                })}
              </div>
              <span className="eng-metodo-txt">
                {ganaAhora
                  ? <><strong>Nuevo paso tuyo.</strong> Llevas {nGanados} de 8 del método.</>
                  : <>Llevas <strong>{nGanados} de 8</strong> pasos del método.</>}
              </span>
            </div>

            {completaAhora ? (
              /* 🎓 Con esta acaba de llenar el plan. Ofrecerle acá «dame una
                 más difícil» sería mentirle: la ronda se corta igual y lo
                 siguiente es su diploma. Así que se le dice. */
              <div className="eng-nav">
                <span className="muted eng-conteo">📋 {PLAN.length} de {PLAN.length}</span>
                <button
                  className="btn btn-oro"
                  onClick={() => avanzar({ eco, via, acerto, noSe: dijoNoSe })}
                >
                  🎓 Ver mi plan completo →
                </button>
              </div>
            ) : yaLoDomina ? (
              /* Regla 4 hasta el final: el timón es suyo. Más hondo en lo
                 mismo (vertical) o terreno nuevo (lateral). */
              <>
                <p className="eng-cuerpo eng-domina-nota">{DOMINA.nota}</p>
                <div className="eng-opciones">
                  {DOMINA.opciones.map((o) => (
                    <button
                      key={o.id}
                      className="eng-opcion eng-opcion-eco"
                      onClick={() => avanzar(
                        { eco, via, acerto: true },
                        // En los dos casos `sinRespiro`: acaba de decir para
                        // dónde quiere ir, y contestarle con «¿cómo vamos?»
                        // sería no haberlo escuchado.
                        o.id === 'hondo'
                          ? { masHondo: true, directo: true, sinRespiro: true }
                          : { otroTema: true, sinRespiro: true },
                      )}
                    >
                      <span className="eng-opcion-txt">{o.txt}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : angElegido ? (
              /* Tras la explicación a medida: probarse es opción, no trámite.
                 Y se prueba con OTRA del tema — repetir la que acaba de leer
                 explicada no probaría nada. */
              <div className="eng-nav eng-nav-doble">
                <button
                  className="btn btn-fantasma"
                  onClick={() => avanzar(
                    { eco, via: 'duda', angulo: angElegido },
                    { masHondo: true, directo: true, sinRespiro: true },
                  )}
                >
                  Ahora ponme a prueba →
                </button>
                <button
                  className="btn"
                  onClick={() => avanzar({ eco, via: 'duda', angulo: angElegido })}
                >
                  Ya está más claro, sigamos →
                </button>
              </div>
            ) : (
              <div className="eng-nav">
                <span className="muted eng-conteo">{catActual?.icono} {catActual?.chip}</span>
                <button
                  className="btn"
                  onClick={() => avanzar({ eco, via, acerto, noSe: dijoNoSe })}
                >
                  {nHechas + 1 >= estado.total ? 'Ver qué aprendió ALTO de mí →' : 'Siguiente →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 5. EL RESPIRO: cada tres temas, el timón vuelve a su mano ────
            Es el antídoto de la sobrecarga. Y cuando ya sabemos por dónde va,
            se le dice y se le ofrece entrar: hacerle completar la ronda «por
            completarla» sería tratarlo como una encuesta con cuota. */}
        {paso === 'respiro' && (
          <div className="eng-card eng-respiro">
            {respiro?.senal ? (
              <>
                <div className="eng-icono" aria-hidden="true">🧭</div>
                <h2 className="eng-titulo">Creo que ya te entendí</h2>
                <p className="eng-cuerpo">
                  {respiro.senal === 'cero' ? (
                    <>
                      Casi nada de esto te sonaba, así que no tiene sentido seguir preguntando: ya
                      sé por dónde empezar contigo, y es <strong>por el principio</strong>. Podemos
                      entrar ahora, o seguir conversando si le estás agarrando el gusto.
                    </>
                  ) : (
                    <>
                      Vienes acertando casi todo. Ya sé que no necesitas la clase introductoria —
                      podemos entrar directo a analizar empresas, o seguir un rato más si quieres
                      completar el método de 8 pasos.
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="eng-icono" aria-hidden="true">☕</div>
                <h2 className="eng-titulo">{frase(RESPIRO.titulos, nHechas)}</h2>
                <p className="eng-cuerpo">
                  Van <strong>{nHechas}</strong> temas y ya cruzaste{' '}
                  <strong>{new Set(estado.respuestas.map((r) => r.cat)).size}</strong> mundos
                  distintos. Nadie te está apurando: seguimos hasta donde tú quieras.
                </p>
                <div className="eng-chips eng-chips-rastro">
                  {[...new Set(estado.respuestas.map((r) => r.cat))].map((c) => (
                    <span key={c} className="eng-chip">
                      {categoria(c)?.icono} {categoria(c)?.chip}
                    </span>
                  ))}
                </div>
              </>
            )}
            <div className="eng-opciones">
              {RESPIRO.opciones.map((o) => (
                <button
                  key={o.id}
                  className={'eng-opcion eng-opcion-eco' + (o.id === 'entrar' ? ' eng-opcion-suave' : '')}
                  onClick={() => {
                    if (o.id === 'entrar') { cerrarRonda(estado); return }
                    const p = siguientePregunta(estado, { otroTema: o.id === 'otro' })
                    if (!p) { cerrarRonda(estado); return }
                    setAviso(null); abrir(p)
                  }}
                >
                  <span className="eng-opcion-txt">{o.txt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 6b. EL DIPLOMA (25-jul, pedido de Jair) ─────────────────────
            Cuando los 8 pasos están ganados, el cierre cambia de género: ya
            no es «te falta esto», es el método entero devuelto en limpio. De
            cada paso se dice lo mismo tres veces desde ángulos distintos —
            de qué trata, con qué frase suya lo demostró, y cómo eso se
            mueve en el mercado — porque un método que no se puede repetir en
            voz alta no se lleva puesto. Y al final se le dice lo único que
            queda por decir: que era sencillo, y a qué nivel subir. */}
        {paso === 'final' && resultado?.planCompleto && (
          <div className="eng-card eng-final eng-diploma">
            <div className="eng-icono" aria-hidden="true">🎓</div>
            <h2 className="eng-titulo">{GRADUACION.titulo}</h2>
            <p className="eng-cuerpo">{GRADUACION.entrada}</p>

            <p className="eng-subtitulo">
              📋 Tu plan, paso por paso
              <span className="eng-subtitulo-conteo">{PLAN.length} de {PLAN.length}</span>
            </p>
            <ol className="eng-dip-plan">
              {resultado.plan.map((p, i) => (
                <li className="eng-dip-paso" key={p.id} style={{ '--i': i }}>
                  <p className="eng-dip-cab">
                    <span className="eng-dip-num" aria-hidden="true">{i + 1}</span>
                    <span className="eng-dip-tit">
                      <strong>{p.icono} {p.titulo}</strong>
                      <span className="eng-chip eng-chip-ok eng-dip-insignia">{p.insignia}</span>
                    </span>
                  </p>
                  <p className="eng-dip-linea">
                    <span className="eng-dip-etq">De qué trata</span>
                    {p.frase}
                  </p>
                  {p.prueba && (
                    <p className="eng-dip-linea eng-dip-tuyo">
                      <span className="eng-dip-etq">Tú ya lo hiciste</span>
                      Lo reconociste en «{sinComillas(p.prueba.gancho)}», y acertaste qué
                      significaba.
                    </p>
                  )}
                  {p.prueba?.puente && (
                    <p className="eng-dip-linea eng-dip-mercado">
                      <span className="eng-dip-etq">En el mercado</span>
                      {p.prueba.puente}
                    </p>
                  )}
                  <p className="eng-dip-vale">{p.elogio}</p>
                </li>
              ))}
            </ol>

            <p className="eng-completo">{GRADUACION.sencillo}</p>

            {/* La recomendación de subir. Se nombra el nivel por su nombre y
                se dice POR QUÉ ese: «sube de nivel» a secas es una orden. */}
            <div className="eng-subir">
              <p className="eng-subir-tit">
                <span aria-hidden="true">📊</span> Lo que sigue: <strong>{GRADUACION.nivelNombre}</strong>
                <span className="eng-subir-num">nivel {GRADUACION.nivel}</span>
              </p>
              <p className="eng-cuerpo">{GRADUACION.nivelPorque}</p>
            </div>

            {/* 🎚️ LOS CUATRO NIVELES, EXPLICADOS (pedido de Jair, 26-jul).
                Hasta ahora el nivel se le asignaba y listo; el que terminaba
                el plan nunca llegaba a ver que existen cuatro formas de mirar
                la misma ficha. Acá se muestran los cuatro con lo que abre cada
                uno, y el suyo queda marcado — sigue siendo una recomendación,
                pero ya es una elección informada. Se toca y se cambia. */}
            <p className="eng-subtitulo">
              🎚️ Los cuatro niveles
              <span className="eng-subtitulo-conteo">elige el tuyo</span>
            </p>
            <p className="eng-cuerpo eng-niveles-lead">
              Es la misma app y las mismas 115 empresas: lo que cambia es cuánto te muestra cada
              ficha. Puedes cambiarlo cuando quieras con el 🎚️ de arriba.
            </p>
            <div className="eng-niveles">
              {NIVELES.map((n) => (
                <button
                  key={n.id}
                  className={'eng-nivel' + (nivelElegido === n.id ? ' elegido' : '')}
                  style={{ '--nv': colorNivel(n.id), '--i': n.id }}
                  onClick={() => setNivelElegido(n.id)}
                  aria-pressed={nivelElegido === n.id}
                >
                  <span className="eng-nivel-icono" aria-hidden="true">{n.icono}</span>
                  <span className="eng-nivel-cuerpo">
                    <span className="eng-nivel-cab">
                      <strong>{n.corto}</strong>
                      <span className="eng-nivel-num">nivel {n.id}</span>
                      {n.id === GRADUACION.nivel && (
                        <span className="eng-nivel-reco">el tuyo</span>
                      )}
                    </span>
                    {/* Para QUIÉN es. Va siempre visible, incluso plegado: es
                        lo primero que necesita alguien que no sabe cuál le
                        toca — reconocerse a sí mismo en una línea. */}
                    <span className="eng-nivel-quien">{n.paraQuien}</span>
                    {/* El resto se despliega solo en el elegido: cuatro fichas
                        completas eran 900 px de scroll para leer lo mismo
                        cuatro veces. Tocar otro nivel mueve la explicación. */}
                    {nivelElegido === n.id && (
                      <span className="eng-nivel-abre">
                        <span className="eng-nivel-frase">«{n.frase}»</span>
                        <span className="eng-nivel-detalle">{n.detalle}</span>
                        <span className="eng-nivel-chips">
                          {n.incluye.slice(0, 4).map((x, i) => (
                            <span key={x} className="eng-nivel-chip" style={{ '--i': i }}>{x}</span>
                          ))}
                        </span>
                        {n.sinEsto && (
                          <span className="eng-nivel-sin">
                            <span aria-hidden="true">·</span> {n.sinEsto}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="eng-nivel-marca" aria-hidden="true">
                    {nivelElegido === n.id ? '✓' : ''}
                  </span>
                </button>
              ))}
            </div>

            {/* Las tres salidas del graduado (pedido de Jair, 25-jul). Las dos
                primeras lo dejan analizando una empresa de verdad —que es todo
                el punto de haber aprendido el método— y suben a nivel 3; la
                tercera es puro gusto. Ninguna lo deja parado en una pantalla
                de felicitaciones sin nada que hacer después. */}
            <div className="eng-nav eng-nav-final">
              <button
                className="btn btn-oro"
                onClick={() => onFin({
                  ...resultado,
                  nivel: nivelElegido,
                  saltaLeccion: true,
                  subirNivel: true,
                  alAzarConAyuda: true,
                })}
              >
                🎲 Analizar una al azar, con ayuda
              </button>
              <button
                className="btn"
                onClick={() => onFin({
                  ...resultado,
                  nivel: nivelElegido,
                  saltaLeccion: true,
                  subirNivel: true,
                  explorar: true,
                })}
              >
                🔎 Prefiero buscarla yo mismo
              </button>
              <button className="btn btn-fantasma" onClick={repetirTodo}>
                🔁 Hacerlo otra vez, con otros ángulos
              </button>
              {/* Entrar sin ir a ninguna ficha: el nivel que eligió arriba se
                  respeta igual. Salir no puede costarle la elección que acaba
                  de hacer. */}
              <button
                className="btn btn-fantasma eng-salida-suave"
                onClick={() => onFin({
                  ...resultado,
                  nivel: nivelElegido,
                  saltaLeccion: true,
                  subirNivel: true,
                })}
              >
                {GRADUACION.ctaSuave}
              </button>
            </div>
            <p className="eng-pie muted">
              Esto no es un certificado ni queda registrado en ningún lado: sirve para que la app
              se acomode a ti. Puedes cambiar de nivel cuando quieras con el 🎚️ de arriba.
            </p>
          </div>
        )}

        {/* ── 6. EL CIERRE: se le devuelve lo que dijo, con sus palabras ─── */}
        {paso === 'final' && resultado && !resultado.planCompleto && (
          <div className="eng-card eng-final">
            {/* 1. EL ELOGIO — pedido de Jair. Se gana, no se regala: si acertó
                poco, se le reconoce lo que SÍ hizo en vez de inventarle un
                logro. Un elogio falso se nota y quema todo lo demás. */}
            {/* Abierto con «ver mi plan» no hubo ronda que elogiar: felicitar
                por 0 de 0 sería el elogio falso que esta pantalla no hace. */}
            <div className="eng-icono" aria-hidden="true">
              {soloPlan ? '📋' : resultado.intentos && resultado.aciertos >= resultado.intentos * 0.6 ? '👏' : '🌱'}
            </div>
            <h2 className="eng-titulo">
              {soloPlan ? 'Tu plan para nuevo inversor' : resultado.elogio.titulo}
            </h2>
            <p className="eng-cuerpo">
              {soloPlan
                ? `Así va por ahora: ${resultado.dominados.length} de ${PLAN.length} pasos ganados. Cada uno se gana reconociendo una frase que ya escuchaste por ahí, no estudiando.`
                : resultado.elogio.texto}
            </p>

            {/* 2. LAS INSIGNIAS: qué sabe hacer, dicho con nombre propio */}
            {resultado.dominados.length > 0 && (
              <>
                <p className="eng-subtitulo">Lo que ya sabes hacer</p>
                <div className="eng-chips">
                  {resultado.dominados.map((p) => (
                    <span key={p.id} className={'eng-chip eng-chip-ok' + (p.recienGanado ? ' nuevo' : '')}>
                      {p.icono} {p.insignia}
                    </span>
                  ))}
                </div>
                <p className="eng-cuerpo eng-elogio-detalle">
                  {resultado.dominados[resultado.dominados.length - 1].elogio}
                </p>
              </>
            )}

            {/* 3. EL PLAN: los temas no eran sueltos, eran un método */}
            <p className="eng-subtitulo">
              📋 El plan para entender cualquier empresa
              <span className="eng-subtitulo-conteo">
                {resultado.dominados.length} de {PLAN.length}
              </span>
            </p>
            <ol className="eng-plan">
              {resultado.plan.map((p, i) => (
                <li key={p.id} className={'eng-plan-paso ' + p.estado}>
                  <span className="eng-plan-marca" aria-hidden="true">
                    {p.estado === 'dominado' ? '✅' : p.estado === 'visto' ? '👀' : p.estado === 'luego' ? '⏳' : '⬜'}
                  </span>
                  <span className="eng-plan-txt">
                    <strong>{i + 1}. {p.titulo}</strong>
                    <span className="eng-plan-frase">
                      {p.estado === 'visto'
                        ? 'Te lo expliqué acá — con una que aciertes, queda tuyo.'
                        : p.estado === 'luego'
                          ? 'Lo dejaste para después. Sigue esperándote, sin apuro.'
                          : p.frase}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            {/* 4. Lo que falta, dicho como invitación y no como deuda. Acá va
                la oferta principal: completar los pasos que quedan es UNA
                opción a un toque, no algo que haya que ir a buscar al menú. */}
            <p className="eng-cuerpo eng-falta">
              Te faltan <strong>{resultado.pasosFaltantes.length}</strong> de {PLAN.length} pasos
              para tener el plan completo. Ninguno es tarea: los agarras cuando tengas ganas, y
              cuando estén los ocho te lo devuelvo entero y explicado.
            </p>

            {/* 5. El terreno cruzado (lateral) y lo que reconoció */}
            {resultado.catsReconocidas.length > 0 && (
              <>
                <p className="eng-subtitulo">Lo que ya te sonaba</p>
                <p className="eng-cuerpo eng-resumen">
                  De {resultado.totalEco}, te sonaron <strong>{resultado.reconocidas}</strong>
                  {resultado.vagas > 0 && <> (y {resultado.vagas} de esas nunca te las explicaron)</>}.
                  {resultado.territorios.length > 1 && (
                    <> Pasaste por <strong>{resultado.territorios.length}</strong> mundos distintos.</>
                  )}
                </p>
                <div className="eng-chips">
                  {resultado.catsReconocidas.map((c) => (
                    <span key={c} className="eng-chip">
                      {categoria(c)?.icono} {categoria(c)?.chip}
                    </span>
                  ))}
                </div>
              </>
            )}

            {!soloPlan && <p className="eng-cuerpo">{CIERRES[resultado.ruta].texto}</p>}

            {resultado.ficha && (
              <p className="eng-puente">
                <span aria-hidden="true">🔗</span> Cuando quieras, tu primera ficha puede ser{' '}
                <strong>{resultado.ficha.nombre}</strong>: {resultado.ficha.porque}.
              </p>
            )}

            <div className="eng-nav eng-nav-final">
              {hayBancoPara(resultado.pasosFaltantes) > 0 && (
                <button className="btn btn-oro" onClick={() => otraRonda(resultado.pasosFaltantes)}>
                  📋 Completar el plan — me faltan {resultado.pasosFaltantes.length}
                </button>
              )}
              <button
                className="btn btn-fantasma"
                onClick={() => (soloPlan && onSalir ? onSalir() : onFin(resultado))}
              >
                {soloPlan ? 'Cerrar' : CIERRES[resultado.ruta].cta}
              </button>
              <button className="btn btn-fantasma" onClick={() => onFin({ ...resultado, verFicha: true })}>
                Mejor mírame {resultado.ficha.nombre} →
              </button>
            </div>
            <p className="eng-pie muted">
              Nada de esto es una nota ni queda en ningún lado: solo sirve para que la app se
              acomode a ti. Puedes cambiar de nivel cuando quieras con el 🎚️ de arriba.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
