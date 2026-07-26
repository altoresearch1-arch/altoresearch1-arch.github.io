import banco from '../data/enganche.json'

// ─────────────────────────────────────────────────────────────────────────
// 🗣️ LA LÓGICA DE LA CONVERSACIÓN — quién habla, cuándo y por qué
// Pedido de Jair (24-jul, ampliado el 25-jul): la primera experiencia no debe
// ser un curso ni un examen, y sobre todo NO debe sentirse un cuestionario.
// Un cuestionario pregunta para llenar casillas; un mentor pregunta para saber
// qué decir a continuación. Ese es todo el rediseño, y de ahí salen las diez
// reglas que manda este archivo:
//
//   1. Ninguna pregunta se hace «para recopilar»: cada respuesta CAMBIA lo que
//      pasa después. Si dos respuestas llevan a la misma pantalla, la pregunta
//      sobra y se borra.
//   2. Si dice que no conoce algo, se deja de preguntar. Ahí toca una salida
//      natural: se lo explicamos ahora, lo adivina si quiere, o seguimos.
//   3. Si sabe a medias, UNA sola pregunta —qué parte no le cuadró— y la
//      explicación se arma con esa respuesta (ver ANGULOS).
//   4. Si ya lo domina, no se le repite lo básico: baja de profundidad en el
//      mismo tema o cambia de tema. Nunca se le explica lo que acaba de probar.
//   5. Nunca dos preguntas de comprensión seguidas sin haberle dado algo en el
//      medio. La explicación no es el premio por acertar: es el hilo.
//   6. Las opciones hablan como una persona («No, ¿qué es?»), no como un
//      formulario («Primera vez que lo escucho»).
//   7. Lo que sigue lo decide cómo viene respondiendo, no una lista fija.
//   8. Siempre existe «lo vemos después», y posponer NO castiga: no resta, no
//      baja de ruta y el tema queda esperando, no reprobado.
//   9. Esto es un mentor guiando, no una app evaluando.
//  10. Cada pantalla tiene que quitar una duda, despertar curiosidad o dar
//      sensación de avance. La que no hace ninguna de las tres, sobra.
//
// Se miden DOS cosas distintas, y esa distinción es el corazón del ruteo:
//   · RECONOCIMIENTO — «esto lo he visto» (aunque no lo entienda).
//   · COMPRENSIÓN    — acertó qué significaba.
// Un usuario puede reconocerlo TODO y no entender nada: ese es justamente el
// perfil peruano más común (vive rodeado de titulares de cobre, dólar y AFP).
//
// Regla de la casa: «No sé» NUNCA castiga, y decir «no lo conozco» tampoco.
// Son las respuestas más honestas que puede dar alguien que recién llega.
// ─────────────────────────────────────────────────────────────────────────

export const CLAVE_ENGANCHE = 'alto-enganche'
// Meta SUAVE de temas por ronda. Ya no es «8 preguntas»: hay turnos que no
// preguntan nada (una mini clase, un tema pospuesto) y siguen contando como
// avance, porque avanzar no es responder — es entender algo más que antes.
export const TEMAS_POR_RONDA = 8
export const PREGUNTAS_POR_RONDA = TEMAS_POR_RONDA // nombre viejo, mismo valor

export const CATEGORIAS = banco.categorias
export const PREGUNTAS = banco.preguntas
export const TOTAL_BANCO = banco.preguntas.length
// 📋 El plan de 8 pasos para entender una empresa. Cada pregunta entrena uno
// (campo `paso`), y el cierre le muestra el plan con lo que ya tocó marcado.
// Es lo que convierte 8 turnos sueltos en un método que se lleva puesto.
export const PLAN = banco.plan
const PASO = Object.fromEntries(banco.plan.map((p) => [p.id, p]))
export const paso = (id) => PASO[id]

const CAT = Object.fromEntries(banco.categorias.map((c) => [c.id, c]))
export const categoria = (id) => CAT[id]

// 🗣️ Cómo se pregunta el «¿te suena?». No es lo mismo un titular del noticiero
// que algo que le salió en el feed: preguntarlo igual es lo que suena a robot.
export const VOCES = banco.voces
export const voz = (eco) => VOCES[eco] ?? VOCES.calle
// Las tres respuestas humanas (regla 6). Viven en el JSON para que Jair las
// edite sin abrir la pantalla.
export const ECOS = banco.ecos
// Las tres formas de no entender algo (regla 3). Cada una arma una explicación
// distinta — no es un adorno, cambia qué se muestra primero.
export const ANGULOS = banco.angulos
export const angulo = (id) => ANGULOS.find((a) => a.id === id)

// El escalón decide de qué TIPO se saca la siguiente pregunta. Sube cuando
// acierta y baja cuando falla o no conocía el tema: si alguien viene
// entendiendo, se le deja de preguntar lo obvio; si se está perdiendo, se
// vuelve a la calle.
const TIPO_POR_ESCALON = { 1: 'vida', 2: 'puente', 3: 'concepto' }

// Las categorías donde una respuesta se puede convertir HOY en una ficha
// peruana concreta. Se usan para el destino final ("ya que te suena el cobre,
// mira quién lo vende desde Perú"). Los tickers existen en empresas.json.
const FICHA_POR_CAT = {
  metales: { ticker: 'CVERDEC1', nombre: 'Cerro Verde', porque: 'es una de las minas de cobre más grandes del país' },
  mineras: { ticker: 'BVN', nombre: 'Buenaventura', porque: 'produce oro y plata, y cotiza también en Nueva York' },
  industria: { ticker: 'CORAREI1', nombre: 'Aceros Arequipa', porque: 'es el fierro de la construcción peruana, y le pega de lleno el antidumping' },
  mar: { ticker: 'EXALMC1', nombre: 'Exalmar', porque: 'vive de la cuota de anchoveta y de la harina de pescado' },
  bolsillo: { ticker: 'ALICORC1', nombre: 'Alicorp', porque: 'está en tu cocina — cuando suben los precios, sus números lo cuentan' },
  dividendos: { ticker: 'BACKUSI1', nombre: 'Backus', porque: 'es de las que reparten buena parte de lo que gana' },
  lios: { ticker: 'AENZAC1', nombre: 'Aenza', porque: 'arrastra en sus números un caso judicial que salió en todos lados' },
  empresas: { ticker: 'ALICORC1', nombre: 'Alicorp', porque: 'es grande, conocida y sus números se leen fácil' },
  gigantes: { ticker: 'ALICORC1', nombre: 'Alicorp', porque: 'es la versión peruana de eso: una empresa que ya conoces de la bodega' },
  mundo: { ticker: 'CVERDEC1', nombre: 'Cerro Verde', porque: 'es la punta peruana de esa cadena mundial' },
  bolsa: { ticker: 'ALICORC1', nombre: 'Alicorp', porque: 'tiene un negocio simple y números claros — buena para la primera vez' },
  cripto: { ticker: 'ALICORC1', nombre: 'Alicorp', porque: 'para ver la diferencia: acá sí hay ventas, costos y utilidades' },
  trading: { ticker: 'ALICORC1', nombre: 'Alicorp', porque: 'para empezar por el negocio en vez del gráfico' },
  enlaces: { ticker: 'CVERDEC1', nombre: 'Cerro Verde', porque: 'es el cobre que termina dentro de los centros de datos y los autos eléctricos' },
  geo: { ticker: 'ALICORC1', nombre: 'Alicorp', porque: 'compra trigo y aceite importados: los mapas y los fletes le llegan al costo' },
  varas: { ticker: 'BAP', nombre: 'Credicorp', porque: 'es un banco, y se mide con una vara distinta a la de una mina' },
}
export const fichaDeCat = (cat) => FICHA_POR_CAT[cat] ?? FICHA_POR_CAT.bolsa

// 🎨 EL AIRE DE CADA TERRITORIO (25-jul). Cambiar de tema tiene que SENTIRSE,
// no solo leerse en un chip. Cada categoría tiñe muy suave el resplandor del
// fondo (12-14%, nunca la tipografía ni los botones): el oro de ALTO manda
// igual, pero al cruzar de la pesca al cobre el aire cambia de temperatura.
// Es la progresión lateral hecha atmósfera.
const TONO_CAT = {
  mundo: '#5b86c4',      // Wall Street: azul de pantalla
  gigantes: '#7f8fa6',   // Nvidia/Apple: gris tecnológico
  cripto: '#e0a13c',     // Bitcoin: ámbar
  bolsillo: '#5aa06f',   // el dólar y los precios: verde billete
  metales: '#c07a3e',    // cobre
  mineras: '#c8a44a',    // el oro peruano
  industria: '#8b8f96',  // acero
  mar: '#3f95a3',        // el mar
  lios: '#b5544a',       // juicios: rojo apagado
  dividendos: '#b98cc0', // el regalo
  trading: '#a86c9b',    // el casino
  bolsa: '#c8a44a',
  empresas: '#9a8f77',
  enlaces: '#6f9bb5',
  geo: '#6d8f5e',
  varas: '#a9a08c',
}
export const tonoDeCat = (cat) => TONO_CAT[cat] ?? '#c8a44a'

// ⬇️ LAS TRES HONDURAS. El escalón ya existía en el motor (decide de qué tipo
// sale la siguiente pregunta), pero era invisible. Mostrarlo convierte el
// avance vertical en algo que se ve bajar: de lo que cualquiera ve en la calle
// al mecanismo, y del mecanismo a la vara con la que se mide.
// Regla de la casa: esta escalera NUNCA baja en pantalla. Se guarda lo más
// hondo que llegó, porque retroceder un peldaño delante de sus ojos es
// exactamente el castigo que la app promete no hacer.
export const HONDURAS = [
  { id: 'vida', icono: '👀', txt: 'Lo que se ve', sub: 'el titular, la frase de TikTok' },
  { id: 'puente', icono: '🔗', txt: 'Por qué mueve plata', sub: 'de la noticia a la caja de una empresa' },
  { id: 'concepto', icono: '📏', txt: 'Con qué vara se mide', sub: 'lo que mira un analista' },
]

/** La pregunta del banco, por id (para poder mostrar CON QUÉ ganó cada paso). */
export const preguntaPorId = (id) => PREGUNTAS.find((p) => p.id === id) ?? null

/** Los pasos del plan que ya tiene ganados AHORA MISMO (esta ronda + las previas). */
export function pasosDominados(estado) {
  const ya = new Set(leerPlanGuardado())
  for (const r of estado.respuestas) if (r.acerto) ya.add(r.paso)
  return ya
}
// Cuando el usuario reconoce varias, se prefiere una de estas: son las que
// convierten un titular en algo peruano y tocable.
const CATS_PERU = ['metales', 'mineras', 'industria', 'mar', 'lios', 'enlaces', 'bolsillo', 'dividendos']

function alAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)]
}
// Las frases del mentor rotan, pero no al azar: se eligen por el número de
// turno. Al azar significaría que la misma pantalla dice cosas distintas si
// React la vuelve a pintar, y eso —que el mentor cambie de frase solo— es
// exactamente la sensación de máquina que estamos sacando.
const porTurno = (pool, n) => pool[n % pool.length]

export const CLAVE_VISTAS = 'alto-enganche-vistas'

/** Las preguntas que ya le salieron en rondas ANTERIORES (para no repetirlas). */
export function leerVistas() {
  try { return JSON.parse(localStorage.getItem(CLAVE_VISTAS) || '[]') } catch { return [] }
}
function guardarVistas(ids) {
  try { localStorage.setItem(CLAVE_VISTAS, JSON.stringify(ids.slice(-TOTAL_BANCO))) } catch { /* incógnito */ }
}

/**
 * Estado inicial de una conversación.
 * @param opts.pasos    si viene, la ronda se limita a esos pasos del plan. Es
 *                      la RONDA DE REFUERZO: «otra vuelta, solo de lo que te
 *                      falta».
 * @param opts.escalon  desde dónde arranca. El que en la puerta dijo «más o
 *                      menos, pero nunca lo entendí bien» empieza en 2: se
 *                      cree lo que dijo de sí mismo y no se le hace pasar por
 *                      «¿qué es una acción?». Si se equivoca, la primera
 *                      respuesta lo baja sola — sin decírselo.
 */
export function nuevaConversacion(total = TEMAS_POR_RONDA, opts = {}) {
  return {
    total,
    vistas: [],            // ids de ESTA ronda
    previas: leerVistas(), // ids de rondas anteriores: se evitan mientras quede banco
    // { id, cat, paso, eco, via, intento, acerto, noSe, pospuesto, angulo }
    respuestas: [],
    escalon: opts.escalon ?? 1,
    // 📋 Los pasos del plan que YA son suyos (de esta ronda y de las
    // anteriores). El motor los necesita en cada turno: una pregunta de un
    // paso ya ganado no mueve el plan ni un milímetro, y tres seguidas de esas
    // es la sensación exacta de «llevo rato contestando y no avanzo».
    dominados: leerPlanGuardado(),
    ultimaCat: null,
    ultimoPaso: null,
    // Regla 5: cuántas preguntas de comprensión lleva sin que le devolvamos
    // nada. Si esto llega a 2, el motor mete un turno que da antes de pedir.
    seguidas: 0,
    // Cuántas veces se le explicó algo (para el «¿seguimos o entramos?»).
    dadas: 0,
    pasosPermitidos: opts.pasos ?? null,
    refuerzo: !!opts.pasos,
  }
}

/** Cuántas preguntas se pueden armar de esos pasos (para no ofrecer una ronda vacía). */
export function hayBancoPara(pasos, previas = leerVistas()) {
  const usadas = new Set(previas)
  const libres = PREGUNTAS.filter((p) => pasos.includes(p.paso) && !usadas.has(p.id))
  return libres.length
}

/**
 * Elige el siguiente tema. No es una lista fija armada al inicio: se decide en
 * cada turno, para que la conversación se acomode a cómo viene respondiendo
 * (regla 7).
 * @param opts.otroTema  el usuario pidió cambiar de tema → salto LATERAL: se
 *                       fuerza una categoría por la que no ha pasado.
 * @param opts.masHondo  el usuario pidió una más difícil → bajada VERTICAL: se
 *                       queda en la misma casilla del plan y sube el tipo.
 */
export function siguientePregunta(estado, opts = {}) {
  const vistas = new Set(estado.vistas)
  const catsUsadas = new Set(estado.respuestas.map((r) => r.cat))
  const pasosUsados = new Set(estado.respuestas.map((r) => r.paso))
  const tipo = TIPO_POR_ESCALON[estado.escalon] ?? 'vida'
  // 🎯 LA REGLA DEL AVANCE (26-jul, reclamo de Jair: «hice tres preguntas y
  // sentí que no avancé»). Un paso ya ganado no puede volver a ganarse, así
  // que preguntar de ahí es tiempo que no mueve el plan. Se filtra ANTES que
  // cualquier otra preferencia, y solo se afloja si no queda nada más.
  const ganados = new Set(estado.dominados ?? [])
  const conAvance = (lista) => {
    const suben = lista.filter((p) => !ganados.has(p.paso))
    return suben.length ? suben : lista
  }

  // Volver al enganche desde el ☰ tiene que traer cosas NUEVAS: se saltan las
  // de rondas anteriores mientras quede banco (152 preguntas dan para rato).
  // Cuando se agota, se vuelve a permitir todo en vez de quedarse sin nada.
  const previas = new Set(estado.previas ?? [])
  const delPlan = estado.pasosPermitidos
    ? PREGUNTAS.filter((p) => estado.pasosPermitidos.includes(p.paso))
    : PREGUNTAS
  const frescasDelBanco = delPlan.filter((p) => !vistas.has(p.id) && !previas.has(p.id))
  const libres = frescasDelBanco.length ? frescasDelBanco : delPlan.filter((p) => !vistas.has(p.id))
  if (!libres.length) return null

  // ⬇️ VERTICAL a pedido: «dame una más difícil». Se queda en el mismo paso del
  // plan y sube el tipo. Es la regla 4 hecha código: al que ya demostró que
  // entiende no se le explica de nuevo — se le da más hondo.
  // «Más hondo» tiene que ser del MISMO tema, no de la misma casilla del plan:
  // si pide otra de sequía y le sale una de grupos VIP de señales, la app le
  // acaba de demostrar que no lo escuchó. Por eso el orden es: mismo tema y
  // misma casilla → mismo tema → misma casilla → lo que haya.
  if (opts.masHondo && (estado.ultimoPaso || estado.ultimaCat)) {
    const duras = (lista) => {
      const d = lista.filter((p) => p.tipo === 'concepto')
      return d.length ? d : lista
    }
    const suman = (lista) => lista.filter((p) => !ganados.has(p.paso))
    const mismaCat = libres.filter((p) => p.cat === estado.ultimaCat)
    const ambos = mismaCat.filter((p) => p.paso === estado.ultimoPaso)

    // «Dame una más difícil de esto mismo» tiene DOS promesas y la app tiene
    // que cumplir las dos: el tema que él eligió y la sensación de avanzar.
    // Por eso el orden empieza por lo que cumple ambas y solo al final acepta
    // repetir un paso ya ganado (26-jul: tres seguidas de un paso ganado fue
    // exactamente lo que le hizo sentir que no avanzaba).
    //   1. mismo paso, si todavía le falta ganarlo  → tema + avance
    //   2. mismo tema, otro paso pendiente          → tema + avance
    //   3. cualquier paso pendiente, del más hondo  → avance (se avisa arriba)
    //   4. mismo tema aunque repita                 → ya no queda nada que ganar
    if (!ganados.has(estado.ultimoPaso) && ambos.length) return alAzar(duras(ambos))
    const catQueSuma = suman(mismaCat)
    if (catQueSuma.length) return alAzar(duras(catQueSuma))
    const cualquieraQueSuma = suman(libres)
    if (cualquieraQueSuma.length) return alAzar(duras(cualquieraQueSuma))
    if (ambos.length) return alAzar(duras(ambos))
    if (mismaCat.length) return alAzar(duras(mismaCat))
  }

  // ↔️ LATERAL a pedido: «cambiemos de tema». Territorio nuevo de verdad, no
  // otra pregunta del mismo sitio con distinto título.
  if (opts.otroTema) {
    const nuevoTerritorio = libres.filter((p) => p.cat !== estado.ultimaCat && !catsUsadas.has(p.cat))
    if (nuevoTerritorio.length) return alAzar(conAvance(nuevoTerritorio))
  }

  // 🔗 La conversación ABRE con una cadena. Es la que fija el tono: si la
  // primera pantalla es «¿te suena este titular?», parece encuesta; si es «el
  // celular que tienes en la mano…», parece una conversación.
  // Y vuelve a aparecer cuando lleva dos preguntas sin recibir nada (regla 5):
  // una cadena EXPLICA antes de preguntar, así que rompe la racha dando.
  const cadenas = conAvance(libres.filter((p) => p.eslabones))
  if (cadenas.length && (!estado.respuestas.length || estado.seguidas >= 2)) {
    const frescas = cadenas.filter((p) => p.cat !== estado.ultimaCat)
    return alAzar(frescas.length ? frescas : cadenas)
  }

  // 🎯 Primero lo que hace avanzar el plan; dentro de eso, sin repetir tema.
  const suben = conAvance(libres)
  const noRepiteCat = suben.filter((p) => p.cat !== estado.ultimaCat)
  const base = noRepiteCat.length ? noRepiteCat : suben

  // 📋 Y dentro de los pasos que faltan, los que todavía no salieron en esta
  // ronda. Con 8 turnos y 8 pasos, una ronda completa toca el método entero.
  const dePasoNuevo = base.filter((p) => !pasosUsados.has(p.paso))
  const porPaso = dePasoNuevo.length ? dePasoNuevo : base

  // Dentro de eso, el tipo que toca por escalón (se ablanda si se pierde, se
  // endurece si acierta) y, en empate, una categoría que no haya salido.
  const delTipo = porPaso.filter((p) => p.tipo === tipo)
  const candidatas = delTipo.length ? delTipo : porPaso

  const frescas = candidatas.filter((p) => !catsUsadas.has(p.cat))
  return alAzar(frescas.length ? frescas : candidatas)
}

/**
 * Anota un turno y mueve el escalón.
 * @param via  cómo terminó el tema, y cada uno cuenta distinto:
 *   'sonda'     — contestó la de comprensión (acertó o no).
 *   'clase'     — no lo conocía y pidió que se lo expliquen. No es fallo.
 *   'pospuesto' — «lo vemos después». No es fallo, no resta, no baja de ruta.
 *   'duda'      — sabía a medias y dijo qué parte no le cuadraba.
 *   'prueba'    — después de la explicación quiso probarse. Sí cuenta.
 */
export function anotar(estado, pregunta, datos = {}) {
  const { eco = null, acerto = false, noSe = false, via = 'sonda', angulo: ang = null } = datos
  const intento = via === 'sonda' || via === 'prueba'

  // Posponer y pedir explicación NO castigan (regla 8): el escalón se ablanda
  // porque el tema le quedó grande, no porque haya hecho algo mal.
  let escalon = estado.escalon
  if (intento) escalon = acerto && !noSe ? Math.min(3, escalon + 1) : Math.max(1, escalon - 1)
  else if (via === 'clase' || via === 'pospuesto') escalon = Math.max(1, escalon - 1)

  // Regla 5: preguntar sin haber dado nada suma; cualquier turno donde se
  // explicó algo pone el contador en cero.
  const dioValor = via === 'clase' || via === 'duda' || (intento && !acerto) || via === 'prueba'
  const seguidas = dioValor ? 0 : intento ? estado.seguidas + 1 : estado.seguidas

  return {
    ...estado,
    vistas: [...estado.vistas, pregunta.id],
    respuestas: [...estado.respuestas, {
      id: pregunta.id, cat: pregunta.cat, paso: pregunta.paso,
      eco, via, intento,
      acerto: !!acerto && intento,
      noSe: !!noSe,
      pospuesto: via === 'pospuesto',
      angulo: ang,
    }],
    escalon,
    seguidas,
    dadas: estado.dadas + (dioValor || acerto ? 1 : 0),
    // Ganó el paso en esta misma respuesta: el siguiente turno ya lo sabe y no
    // le vuelve a preguntar de algo que acaba de demostrar.
    dominados: acerto && intento && !estado.dominados?.includes(pregunta.paso)
      ? [...(estado.dominados ?? []), pregunta.paso]
      : (estado.dominados ?? []),
    ultimaCat: pregunta.cat,
    ultimoPaso: pregunta.paso,
  }
}

/**
 * ¿Ya sabemos lo suficiente como para ofrecerle salir? (anti-sobrecarga)
 * Nadie tiene que aguantar ocho turnos para que la app «lo entienda». Cuando
 * la señal es clara —no le suena nada, o viene acertando todo— se le OFRECE
 * cerrar. Ofrecer, no cerrar: la decisión es suya (regla 8).
 */
export function senalSuficiente(estado) {
  const n = estado.respuestas.length
  if (n < 4 || n >= estado.total) return null
  const conEco = estado.respuestas.filter((r) => r.eco != null)
  const nunca = conEco.filter((r) => r.eco === 'nunca').length
  const intentos = estado.respuestas.filter((r) => r.intento)
  const aciertos = intentos.filter((r) => r.acerto).length

  if (conEco.length >= 3 && nunca / conEco.length >= 0.75) return 'cero'
  if (intentos.length >= 4 && aciertos / intentos.length >= 0.85) return 'analisis'
  return null
}

/** Cada tres temas, un respiro con el timón en su mano (regla 8 y 10). */
export function tocaRespiro(estado) {
  const n = estado.respuestas.length
  return n > 0 && n < estado.total && n % 3 === 0
}

/**
 * El ruteo que pidió Jair, en tres caminos:
 *  · reconoce poco o nada          → 'cero'     : se empieza por bolsa, acción e inversión.
 *  · reconoce pero no entiende     → 'basico'   : explicaciones básicas (la Lección Exprés).
 *  · reconoce Y entiende           → 'analisis' : se salta lo básico y va a analizar empresas.
 * Todo va en proporción, así que cortar a la mitad rutea igual de bien.
 * Ojo con lo que NO cuenta: los temas pospuestos y las mini clases no son
 * fallos. Si contaran, «lo vemos después» sería un castigo disfrazado.
 */
export function rutaFinal(estado) {
  const n = estado.respuestas.length || 1
  // Las CADENAS no preguntan «¿te suena?» (arrancan en algo que la persona
  // tiene en la mano), así que no votan en el reconocimiento: si contaran como
  // «no le sonó» ensuciarían la señal y lo mandarían a la ruta equivocada.
  const conEco = estado.respuestas.filter((r) => r.eco != null)
  const nEco = conEco.length || 1
  const reconocidas = conEco.filter((r) => r.eco !== 'nunca').length
  const vagas = conEco.filter((r) => r.eco === 'vago').length
  // COMPRENSIÓN solo sobre lo que de verdad intentó responder.
  const intentos = estado.respuestas.filter((r) => r.intento)
  const aciertos = intentos.filter((r) => r.acerto).length
  const noSabe = estado.respuestas.filter((r) => r.noSe).length
  const clases = estado.respuestas.filter((r) => r.via === 'clase').length
  const pospuestos = estado.respuestas.filter((r) => r.pospuesto).length

  const pReconoce = reconocidas / nEco
  const pAcierta = intentos.length ? aciertos / intentos.length : 0

  let ruta
  if (pReconoce <= 0.3) ruta = 'cero'
  else if (!intentos.length) ruta = 'basico'
  else if (pAcierta >= 0.7 && pReconoce >= 0.5) ruta = 'analisis'
  else ruta = 'basico'

  // Los temas que SÍ le sonaron, para devolvérselos con sus propias palabras.
  const catsReconocidas = [...new Set(
    conEco.filter((r) => r.eco !== 'nunca').map((r) => r.cat)
  )]
  const catsAcertadas = [...new Set(
    intentos.filter((r) => r.acerto).map((r) => r.cat)
  )]
  // ↔️ El terreno lateral: por cuántos territorios distintos pasó. Es la otra
  // mitad del avance, y sin decirlo no se ve (ocho preguntas de cobre y ocho
  // de ocho temas distintos se sienten igual mientras las respondes).
  const territorios = [...new Set(estado.respuestas.map((r) => r.cat))]

  // La ficha con la que se cierra: de lo que reconoció, se prefiere lo peruano.
  const catFicha =
    catsReconocidas.find((c) => CATS_PERU.includes(c)) ??
    catsReconocidas[0] ??
    territorios[0] ??
    'bolsa'
  const ficha = fichaDeCat(catFicha)

  // 📋 EL PLAN, paso por paso. Cuatro estados y ninguno miente:
  //   dominado  — acertó al menos una de ese paso. La insignia se GANA acá.
  //   visto     — se lo explicamos (falló, dijo «no sé» o pidió la clase).
  //   luego     — lo pospuso él mismo. No es un reproche: está esperándolo.
  //   pendiente — ni siquiera le tocó.
  // Lo ganado en rondas anteriores NO se borra: la segunda vuelta suma sobre la
  // primera. Si no, pedirle «otra ronda de lo que te falta» sería hacerle
  // perder lo que ya había demostrado.
  const yaDominados = new Set(leerPlanGuardado())
  // 🧾 Con QUÉ ganó cada paso. Sin esto, el diploma del final tendría que
  // decir «dominaste el paso 3» y punto, que es una medalla vacía: lo que lo
  // hace suyo es volver a ver la frase concreta con la que lo demostró.
  const pruebasPrevias = leerPruebas()
  const plan = PLAN.map((p) => {
    const suyas = estado.respuestas.filter((r) => r.paso === p.id)
    const acerto = suyas.some((r) => r.acerto) || yaDominados.has(p.id)
    // «Visto» = se lo explicamos, sin importar por qué camino: la mini clase
    // que pidió, la explicación a medida de su duda, o el fallo. En los tres
    // salió sabiendo más que al entrar, y el plan tiene que decirlo.
    const explicado = suyas.some((r) => r.via === 'clase' || r.via === 'duda' || (r.intento && !r.acerto))
    const luego = !acerto && !explicado && suyas.some((r) => r.pospuesto)
    const idPrueba = suyas.find((r) => r.acerto)?.id ?? pruebasPrevias[p.id] ?? null
    const q = idPrueba ? preguntaPorId(idPrueba) : null
    return {
      ...p,
      estado: acerto ? 'dominado' : explicado ? 'visto' : luego ? 'luego' : 'pendiente',
      recienGanado: suyas.some((r) => r.acerto) && !yaDominados.has(p.id),
      preguntas: suyas.map((r) => r.id),
      // La frase con la que lo demostró y el hilo que la ata al mercado.
      prueba: q ? { id: q.id, gancho: q.gancho, pregunta: q.pregunta, puente: q.puente, cat: q.cat } : null,
    }
  })
  const dominados = plan.filter((p) => p.estado === 'dominado')
  const vistos = plan.filter((p) => p.estado === 'visto')
  const paraLuego = plan.filter((p) => p.estado === 'luego')
  const pendientes = plan.filter((p) => p.estado === 'pendiente')
  // Lo que falta para completar el método: primero lo que ya vio explicado,
  // después lo que él mismo dejó para luego, al final lo que nunca salió.
  const pasosFaltantes = [...vistos, ...paraLuego, ...pendientes].map((p) => p.id)

  return {
    ruta,
    nivel: ruta === 'analisis' ? 3 : 2,
    saltaLeccion: ruta === 'analisis',
    refuerzo: !!estado.refuerzo,
    reconocidas,
    vagas,
    aciertos,
    intentos: intentos.length,
    clases,
    pospuestos,
    noSabe,
    total: n,
    totalEco: conEco.length,
    catsReconocidas,
    catsAcertadas,
    territorios,
    ficha,
    plan,
    dominados,
    vistos,
    paraLuego,
    pendientes,
    pasosFaltantes,
    planCompleto: pasosFaltantes.length === 0,
    elogio: elogioGeneral({
      aciertos, reconocidas, intentos: intentos.length, clases, ruta,
      nEco: conEco.length, dominados: dominados.length, territorios: territorios.length,
    }),
  }
}

/**
 * El elogio de arriba del cierre. Pedido de Jair: que le digan «muy bien, ya
 * entiendes de macro, entiendes las noticias». Con una condición nuestra: no se
 * regala. Si acertó poco, se le reconoce lo que SÍ hizo (reconocer titulares,
 * preguntar lo que no sabía) sin inventarle un logro — un elogio falso se nota
 * y quema la confianza en todo lo demás que diga la app.
 */
export function elogioGeneral({ aciertos, reconocidas, intentos, clases = 0, nEco = 1, dominados, territorios = 0, ruta = 'basico' }) {
  // El que casi no se probó pero preguntó todo lo que no sabía. Ese no es un
  // usuario flojo: es el que hace exactamente lo que hay que hacer.
  if (intentos <= 1 && clases >= 2) return {
    titulo: 'Preguntaste en vez de asentir — eso es lo difícil',
    texto: `Te explicamos ${clases} cosas que no conocías, y ninguna te la tragaste de memoria. Así se empieza esto: preguntando qué significa, no fingiendo que ya lo sabías.`,
  }
  const p = intentos ? aciertos / intentos : 0
  // El techo se gana con volumen y coherencia: dos aciertos sueltos no son
  // «esto ya es análisis», y decirlo mientras la app lo manda a la ruta básica
  // es contradecirse en la misma pantalla.
  if (intentos >= 3 && p >= 0.85 && ruta === 'analisis') return {
    titulo: '¡Muy bien! Esto ya es análisis',
    texto: `Acertaste ${aciertos} de ${intentos}, y en ${territorios} temas distintos. Eso ya no es suerte: estás razonando con información que llevabas dando vueltas en la cabeza. Con eso te puedes sentar a mirar una empresa de verdad.`,
  }
  if (intentos >= 2 && p >= 0.6) return {
    titulo: 'Muy bien: lees las noticias mejor de lo que creías',
    texto: `Acertaste ${aciertos} de ${intentos}, y varias eran de las que suenan complicadas. Ya entiendes cómo lo que pasa afuera termina en la caja de una empresa.`,
  }
  if (intentos >= 2 && p >= 0.35) return {
    titulo: 'Vas bien — y lo que falta tiene arreglo',
    texto: `Acertaste ${aciertos} de ${intentos}. Eso no es poco: significa que ya tienes ${dominados} de los 8 pasos del método metidos en la cabeza. Los otros se aprenden igual de rápido.`,
  }
  if (reconocidas >= nEco * 0.5) return {
    titulo: 'Escuchaste más de lo que entendiste — y eso es normal',
    texto: `Te sonaron ${reconocidas} de ${nEco} titulares. Nadie nació sabiendo qué significan: te los dijeron mil veces sin explicártelos nunca. Eso lo arreglamos acá.`,
  }
  return {
    titulo: 'Empezaste, que es lo difícil',
    texto: 'La mayoría no llega ni a preguntar. Vamos a construirlo desde el principio, sin apuro y sin vergüenza. Acá nadie toma examen.',
  }
}

/** Otra vuelta, solo de los pasos que le faltan (o de todos si ya los tiene). */
export function rondaDeRefuerzo(pasos, total = TEMAS_POR_RONDA) {
  const disponibles = hayBancoPara(pasos)
  return nuevaConversacion(Math.max(3, Math.min(total, disponibles)), { pasos })
}

// ── Lo que dice el mentor ─────────────────────────────────────────────────
// Todo el copy conversacional vive acá para que Jair lo edite sin tocar la
// pantalla. Los pools rotan por turno: un mentor no repite la misma frase ocho
// veces seguidas, y esa repetición es medio segundo de «ah, es un robot».

/** Regla 2: no conoce el tema → se deja de preguntar y se ofrece una salida. */
export const NO_CONOCE = {
  entradas: [
    'Perfecto, empecemos desde cero.',
    'Buenísimo que lo digas: así no te lo explico como si ya lo supieras.',
    'Tranquilo, esa la escucho todo el tiempo.',
    'Listo, entonces esta te la cuento yo.',
  ],
  // El cuerpo cambia según lleve mucho o poco dicho «no lo conozco»: al que
  // recién empieza se le anima, al que ya dijo varias se le baja la presión.
  cuerpo: (nunca) => nunca >= 2
    ? 'Van varias que no conocías, y está perfecto — es información que nadie te explicó nunca. Tú dime cómo la quieres.'
    : 'Es una de esas frases que se repiten en todos lados sin que nadie diga qué significan. ¿Te la cuento?',
  opciones: [
    { id: 'clase', txt: 'Cuéntamelo, son 30 segundos' },
    { id: 'adivinar', txt: 'Déjame adivinar primero, a ver si le pego' },
    { id: 'luego', txt: 'Lo vemos más adelante' },
  ],
}

/** Regla 3: sabe a medias → UNA pregunta, y con ella se arma la explicación. */
export const A_MEDIAS = {
  entradas: [
    'Esa es la respuesta más común que hay — y la más honesta.',
    'Media sabida es como llega casi todo el mundo. Vamos a cerrarla.',
    'Te sonaba pero nunca te cuadró. Dime dónde se te traba.',
  ],
  pregunta: '¿Qué parte es la que nunca te cuadró?',
}

/** Regla 8: posponer no castiga, y hay que decirlo en voz alta. */
export const POSPUESTO = [
  'Hecho, queda para después. No se pierde ni te resta nada.',
  'Sin problema, lo dejamos ahí esperando. Cambiemos de tema.',
  'Anotado para más adelante. Nadie te va a apurar con eso.',
]

// 🪡 LOS PUENTES (25-jul). Lo que hacía que esto sonara a cuestionario no eran
// las preguntas: era el silencio entre una y la siguiente. Una persona nunca
// suelta dos temas seguidos sin decir nada en el medio; encadena con lo que
// acabas de contestar. Estas son esas costuras, y por eso están escritas por
// CÓMO terminó el turno anterior, no por número de turno.
export const PUENTES = {
  acerto: [
    'Esa te salió redonda. Vamos con otra cosa.',
    'Bien ahí. Te llevo a otro terreno.',
    'Le pegaste. Sigo por otro lado a ver qué tal.',
  ],
  falla: [
    'Esa se le atraganta a todo el mundo. Sigamos.',
    'Ya está dicha, así que no vuelve a agarrarte desprevenido. Vamos a otra.',
    'Tranquilo, esa es de las que confunden. Cambio de tema.',
  ],
  clase: [
    'Con eso ya en la cabeza, mira esta otra.',
    'Va una más, ahora de otro lado.',
    'Sigamos por acá, que se conecta con lo que acabo de contarte.',
  ],
  hondo: [
    'Bajamos un piso en el mismo tema.',
    'Va una más difícil, la pediste tú.',
    'Misma zona, pero más adentro.',
  ],
  // Pidió más de lo mismo, pero de ese tema ya no queda nada que le sume al
  // plan. Se le dice por qué cambia de sitio en vez de mudarlo en silencio.
  hondoOtro: [
    'De ese tema ya no me queda nada nuevo que sumarte. Te llevo a uno que sí.',
    'Ese ya lo exprimimos. Sigo con otro que todavía te falta.',
    'Ahí ya no te queda nada por ganar, así que te muevo a lo que sí suma.',
  ],
  lateral: [
    'Cambio de terreno.',
    'Nos movemos a otro mundo.',
    'Salimos de ahí, vamos a algo distinto.',
  ],
}

/** Regla 4: ya lo domina → ni una palabra de lo básico. */
export const DOMINA = {
  veredictos: ['Eso mismo.', 'Exacto.', 'Así es, y sin dudarlo.', 'Correcto — y esa no era fácil.'],
  nota: 'No te repito lo básico. Tú dices para dónde:',
  opciones: [
    { id: 'hondo', txt: 'Dame una más difícil de esto mismo' },
    { id: 'otro', txt: 'Cambiemos de tema' },
  ],
}

/** El respiro cada tres temas: el timón, en su mano. */
export const RESPIRO = {
  titulos: [
    '¿Cómo vamos?',
    'Un respiro.',
    'Paramos un segundo.',
  ],
  opciones: [
    { id: 'sigue', txt: 'Sigamos, me está gustando' },
    { id: 'otro', txt: 'Sigamos, pero cambiemos de tema' },
    { id: 'entrar', txt: 'Ya fue, quiero entrar a la app' },
  ],
}

/** Textos del cierre. Viven acá para que Jair los edite sin tocar la pantalla. */
export const CIERRES = {
  cero: {
    titulo: 'Empecemos por el principio, sin vergüenza',
    texto:
      'Casi nada de eso te sonó, y está perfecto: nadie nace sabiendo. Arrancamos por lo primero de todo, qué es una acción, qué es la bolsa y qué significa invertir. En criollo y sin apuro.',
    cta: 'Empezar por lo básico →',
  },
  basico: {
    titulo: 'Ya escuchaste más de lo que crees',
    texto:
      'Reconociste varias cosas, así que la información ya te llega: lo que falta es que alguien te la traduzca. Eso hacemos ahora, y de paso te mostramos a qué empresa peruana le pega cada titular.',
    cta: 'Traducir lo que ya escuché →',
  },
  analisis: {
    titulo: 'No necesitas la clase introductoria',
    texto:
      'No solo te sonaba: entendiste de qué se trataba. Nos saltamos lo básico y te dejamos en el modo donde se analizan empresas de verdad: catalizadores, riesgos, deuda y producción.',
    cta: 'Ir directo a analizar →',
  },
}

/**
 * 🎓 LA GRADUACIÓN (pedido de Jair, 25-jul). Cuando los 8 pasos están ganados,
 * el cierre deja de ser «te faltan cosas» y pasa a ser un diploma: se le
 * devuelve el método entero, paso por paso, con la frase concreta que él mismo
 * reconoció y el hilo que la ata al mercado. Después se le recomienda subir de
 * nivel, que es lo único que queda por hacer.
 * Nivel 3 no se elige por ser «el que sigue»: su propia frase en el selector es
 * «Ya sé lo básico, quiero explorar y comparar», que es exactamente lo que él
 * acaba de demostrar.
 */
export const GRADUACION = {
  titulo: 'Pasaste la prueba: ya sabes lo básico',
  entrada:
    'Los 8 pasos están completos, y ninguno te lo regalamos: cada uno lo ganaste reconociendo una frase que ya habías escuchado por ahí. Esto es el plan entero, con lo tuyo dentro.',
  sencillo:
    '¿Ves que era sencillo? No hay fórmulas raras ni un idioma secreto: son ocho preguntas de sentido común hechas en orden. La diferencia con el que «no entiende de bolsa» es que tú ahora sabes cuáles son y en qué orden van.',
  nivel: 3,
  nivelNombre: 'Quiero analizarla',
  nivelPorque:
    'Es el nivel que dice «ya sé lo básico, quiero explorar y comparar»: te abre catalizadores, riesgos, deuda y producción en cada ficha. Si eliges cualquiera de las dos primeras salidas te subo ahí y llegas con el 💡 Explícamelo encendido, así que puedes tocar lo que no reconozcas y te lo explico en el sitio.',
  ctaSuave: 'Solo entrar a la app, sin ficha',
}

/** Cómo va el plan de 8 pasos según lo guardado (para ofrecerlo desde el inicio). */
export function progresoPlan() {
  const ganados = leerPlanGuardado().filter((id) => PASO[id])
  const faltan = PLAN.filter((p) => !ganados.includes(p.id))
  return {
    ganados: ganados.length,
    total: PLAN.length,
    faltan: faltan.map((p) => p.id),
    completo: faltan.length === 0,
    empezado: leerVistas().length > 0,
    siguiente: faltan[0]?.id ?? null,
  }
}

/** Una frase del mentor elegida por turno (nunca al azar: ver `porTurno`). */
export const frase = porTurno

// ── Memoria (localStorage) ────────────────────────────────────────────────
export const CLAVE_PLAN = 'alto-enganche-plan'
// Qué pregunta le sirvió para ganar cada paso: { paso: idDePregunta }. Se
// guarda aparte y no dentro de CLAVE_PLAN para no romper lo ya guardado.
export const CLAVE_PRUEBAS = 'alto-enganche-pruebas'

/** Los pasos del plan que YA demostró dominar (acertando), de todas las rondas. */
export function leerPlanGuardado() {
  try { return JSON.parse(localStorage.getItem(CLAVE_PLAN) || '[]') } catch { return [] }
}
/** { pasoId: preguntaId } — la frase con la que demostró cada paso. */
export function leerPruebas() {
  try { return JSON.parse(localStorage.getItem(CLAVE_PRUEBAS) || '{}') } catch { return {} }
}

export function guardarEnganche(res, estado) {
  if (estado?.vistas?.length) {
    guardarVistas([...new Set([...(estado.previas ?? []), ...estado.vistas])])
  }
  try {
    localStorage.setItem(CLAVE_PLAN, JSON.stringify(res.dominados.map((p) => p.id)))
    const pruebas = { ...leerPruebas() }
    for (const p of res.dominados) if (p.prueba) pruebas[p.id] = p.prueba.id
    localStorage.setItem(CLAVE_PRUEBAS, JSON.stringify(pruebas))
    localStorage.setItem(CLAVE_ENGANCHE, JSON.stringify({
      fecha: new Date().toISOString().slice(0, 10),
      ruta: res.ruta,
      nivel: res.nivel,
      cats: res.catsReconocidas,
      aciertos: res.aciertos,
      intentos: res.intentos,
      total: res.total,
      ficha: res.ficha?.ticker ?? null,
      pasos: res.dominados.map((p) => p.id),
      // Lo que dejó para después: otras pantallas pueden ofrecérselo cuando
      // tenga sentido, en vez de volver a preguntarle desde cero.
      luego: res.paraLuego.map((p) => p.id),
    }))
  } catch { /* incógnito */ }
}
/** Lo que la conversación dedujo (ruta, temas reconocidos, ficha sugerida).
 *  Queda guardado para que otras pantallas puedan usarlo sin volver a preguntar. */
export function leerEnganche() {
  try { return JSON.parse(localStorage.getItem(CLAVE_ENGANCHE) || 'null') } catch { return null }
}
