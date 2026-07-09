import empresasData from '../data/empresas.json'
import terminosData from '../data/terminos.json'
import glosarioData from '../data/glosario.json'
import tesisData from '../data/tesis.json'
import tipsData from '../data/tips.json'
import hechosData from '../data/hechos.json'
import { precioDe, peInfo, dividendosDe, yieldNumerico } from './finanzas'

// ─────────────────────────────────────────────────────────────────────────
// EL CEREBRO DE YACHAY ("saber/aprender" en quechua) — la IA de ALTO (beta).
//
// No llama a ningún servidor ni API externa: responde SOLO con los datos
// verificados que ya viven en la app (114 empresas, 172 términos, tesis,
// tips, dividendos, hechos de importancia). Por diseño no puede irse de
// tema ni inventar cifras — si no sabe, lo dice (Regla de Oro #1) — y NUNCA
// recomienda comprar (Regla #9). Gratis, privado y funciona sin conexión.
// ─────────────────────────────────────────────────────────────────────────

// minúsculas + sin tildes + sin signos: "¿Qué es el P/E?" -> "que es el p/e"
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    // quitar las tildes "sueltas" que deja NFD (rango Unicode de diacríticos)
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const sinCola = (n) => n.replace(/\s+(S\.?A\.?A?\.?|S\.?A\.?C\.?)\s*$/i, '').trim()

// Índice de empresas: ticker + nombre limpio + palabras "fuertes" del nombre
// (≥5 letras y no genéricas) para pescar "buenaventura", "backus", "unacem"…
const GENERICAS = new Set(['compania', 'corporacion', 'sociedad', 'minera', 'minas', 'banco',
  'grupo', 'empresa', 'peruana', 'peruano', 'holding', 'inversiones', 'industrias',
  'consorcio', 'financiera', 'seguros', 'andina', 'general', 'nacional', 'agraria',
  'agroindustrial', 'azucarera', 'electrica', 'electricidad', 'energia', 'internacional'])

const EMPRESAS = empresasData.empresas.map((e) => {
  const limpio = sinCola(e.nombre)
  const palabras = norm(limpio).split(' ').filter((w) => w.length >= 5 && !GENERICAS.has(w))
  return { ...e, nombreCorto: limpio, alias: norm(limpio), palabras }
})

function buscarEmpresas(q, max = 2) {
  const tokens = q.split(' ')
  const halladas = []
  for (const e of EMPRESAS) {
    let puntos = 0
    if (tokens.includes(norm(e.ticker))) puntos = 100
    else if (e.alias.length >= 4 && q.includes(e.alias)) puntos = 90
    else {
      const aciertos = e.palabras.filter((w) => tokens.includes(w))
      if (aciertos.length > 0) puntos = 50 + aciertos.length * 10 + aciertos.join('').length
    }
    if (puntos > 0) halladas.push({ e, puntos })
  }
  halladas.sort((a, b) => b.puntos - a.puntos)
  return halladas.slice(0, max).map((h) => h.e)
}

// ── Términos: terminos.json (tooltips, la base grande) + glosario.json (árbol con ejemplos)
const TERMINOS = Object.entries(terminosData.terminos || {}).map(([k, v]) => ({
  clave: k, claveNorm: norm(k), def: v,
}))
const GLOSARIO = (glosarioData.ramas || []).flatMap((r) =>
  (r.terminos || []).map((t) => ({ clave: t.t, claveNorm: norm(t.t), def: t.d, ej: t.ej })))

function buscarTermino(q) {
  // 1) "que es X" / "que significa X" / "explicame X"
  const m = q.match(/(?:que es|que significa|que son|explicame|explica|definicion de)\s+(?:el |la |los |las |un |una )?(.{2,40})$/)
  const objetivo = m ? m[1].trim() : null
  const candidatos = objetivo ? [objetivo] : []
  const evaluar = (texto, exigirLargo) => {
    let mejor = null
    for (const t of [...TERMINOS, ...GLOSARIO]) {
      if (exigirLargo && t.claveNorm.length < 3) continue
      const ok = texto === t.claveNorm || texto.startsWith(t.claveNorm + ' ') ||
        (t.claveNorm.length >= 4 && ` ${texto} `.includes(` ${t.claveNorm} `))
      if (ok && (!mejor || t.claveNorm.length > mejor.claveNorm.length)) mejor = t
    }
    return mejor
  }
  for (const c of candidatos) {
    const hit = evaluar(c, false)
    if (hit) return hit
  }
  // 2) sin la frase "qué es": buscar el término MÁS LARGO contenido en la pregunta
  return evaluar(q, true)
}

// ── piezas de texto reutilizables
const tesisDe = (t) => tesisData.tesis?.[t] || null
const tipsDe = (t) => tipsData.tips?.[t] || []
const hechosDe = (t) => hechosData.hechos?.[t]?.hechos || []

function lineaPrecio(t) {
  const px = precioDe(t)
  if (!px || px.precio == null) return '💵 Precio: sin cotización en la BVL (no negocia; su valor está en fundamentos y dividendos).'
  const aviso = px.sinNegociacionReciente ? ' ⚠ poco negociada: es su ÚLTIMO cierre, puede ser viejo' : ''
  return `💵 Precio: ${px.moneda} ${px.precio} (cierre del ${px.fecha}${aviso}).`
}

function lineaPE(t) {
  const pe = peInfo(t)
  if (!pe) return null
  if (pe.perdida) return '📊 P/E: no tiene (la empresa perdió plata en el año; sin ganancia no hay P/E).'
  const ref = pe.referencial ? ' ⚠ referencial (precio viejo)' : ''
  return `📊 P/E: ${pe.pe.toFixed(1)}${ref} — al precio de hoy pagarías ~${pe.pe.toFixed(1)} años de su ganancia anual.`
}

function lineaDividendos(t) {
  const dv = dividendosDe(t)
  if (!dv || (!dv.anualNum && !dv.yield)) return '💰 Dividendos: no está pagando (o no hay registro reciente en la BVL).'
  const y = yieldNumerico(t)
  const extra = y != null && y > 20 ? ' ⚠ OJO: un yield así de alto suele venir de un pago EXTRAORDINARIO, no asumas que se repite' : ''
  const partes = []
  if (dv.anual) partes.push(`paga ~${dv.anual} por acción al año`)
  if (dv.yield) partes.push(`yield ${dv.yield}`)
  if (dv.frecuencia) partes.push(`frecuencia ${dv.frecuencia.toLowerCase()}`)
  return `💰 Dividendos: ${partes.join(' · ')}.${extra}`
}

function lineaHecho(t) {
  const hs = hechosDe(t)
  if (hs.length === 0) return null
  const h = hs[0]
  return `📰 Último hecho de importancia (${h.fecha}): ${h.categoria}${h.titulo ? ' — ' + h.titulo : ''}.`
}

const SECTOR_LEGIBLE = {
  minas: 'minería', alimentos: 'alimentos y bebidas', diversas: 'diversas',
  electricas: 'eléctricas', bancos: 'bancos', textil: 'textil', acereras: 'acero',
  cemento: 'cemento', retail: 'retail', pesqueras: 'pesca', fondos: 'fondos (FIBRAs/ETFs)',
  afp: 'AFP', aseguradoras: 'seguros',
}

function chipsEmpresa(e) {
  return [
    `¿${e.nombreCorto} paga dividendos?`,
    `¿Qué riesgos tiene ${e.nombreCorto}?`,
    `Últimas noticias de ${e.nombreCorto}`,
  ]
}

// ── respuestas por intención ─────────────────────────────────────────────

function respuestaResumen(e) {
  const lineas = [
    `🏢 **${e.nombreCorto}** (${e.ticker}) — sector ${SECTOR_LEGIBLE[e.sector] || e.sector}.`,
    lineaPrecio(e.ticker),
    lineaPE(e.ticker),
    lineaDividendos(e.ticker),
    tesisDe(e.ticker) ? `🧭 Tesis ALTO: ${tesisDe(e.ticker)}` : null,
    tipsDe(e.ticker)[0] ? `💡 Para entenderla: ${tipsDe(e.ticker)[0]}` : null,
    lineaHecho(e.ticker),
  ].filter(Boolean)
  return {
    texto: lineas.join('\n'),
    ticker: e.ticker,
    chips: chipsEmpresa(e),
  }
}

function respuestaDividendos(e) {
  const lineas = [`Sobre los dividendos de **${e.nombreCorto}**:`, lineaDividendos(e.ticker)]
  const y = yieldNumerico(e.ticker)
  if (y != null) lineas.push(`Para comparar: un yield de ${y.toFixed(1)}% significa que, al precio actual, sus pagos del último año equivalen a ese % de lo que cuesta la acción. No es promesa de que se repita.`)
  return { texto: lineas.join('\n'), ticker: e.ticker, chips: [`¿Qué es el yield?`, `¿Qué hace ${e.nombreCorto}?`, 'Ver quién paga más dividendos'] }
}

function respuestaRiesgos(e) {
  const lineas = [`Riesgos y puntos a vigilar de **${e.nombreCorto}** (según los datos, no opinión):`]
  const tesis = tesisDe(e.ticker)
  if (tesis) lineas.push(`🧭 ${tesis}`)
  const RIESGO_RE = /(riesgo|deuda|cae|caida|ojo|cuidado|depende|volatil|ciclo|apalanc|perdida|negativo|sunat|juicio|conflicto)/i
  const avisos = tipsDe(e.ticker).filter((t) => RIESGO_RE.test(t)).slice(0, 3)
  for (const a of avisos) lineas.push(`⚠ ${a}`)
  if (lineas.length === 1) lineas.push('No tengo riesgos específicos registrados; revisa su ficha completa y sus hechos de importancia 📰.')
  return { texto: lineas.join('\n'), ticker: e.ticker, chips: [`¿Qué hace ${e.nombreCorto}?`, `Últimas noticias de ${e.nombreCorto}`, '¿Qué es la deuda neta?'] }
}

function respuestaHechos(e) {
  const hs = hechosDe(e.ticker).slice(0, 3)
  if (hs.length === 0) {
    return { texto: `No tengo hechos de importancia recientes de **${e.nombreCorto}** en mi registro (últimos 12 meses de la BVL).`, ticker: e.ticker, chips: chipsEmpresa(e) }
  }
  const lineas = [`Últimos hechos de importancia de **${e.nombreCorto}** (comunicados oficiales a la BVL):`]
  for (const h of hs) lineas.push(`📰 ${h.fecha} · ${h.categoria}${h.titulo ? ' — ' + h.titulo : ''}`)
  lineas.push('En su ficha están todos, con el PDF oficial de cada uno.')
  return { texto: lineas.join('\n'), ticker: e.ticker, chips: [`¿Qué hace ${e.nombreCorto}?`, '¿Qué es un hecho de importancia?'] }
}

function respuestaPrecio(e) {
  return {
    texto: [`Sobre el precio de **${e.nombreCorto}**:`, lineaPrecio(e.ticker), lineaPE(e.ticker)].filter(Boolean).join('\n'),
    ticker: e.ticker,
    chips: [`¿Qué es el P/E?`, `¿Qué hace ${e.nombreCorto}?`, `¿${e.nombreCorto} paga dividendos?`],
  }
}

function respuestaTopDividendos() {
  const top = EMPRESAS
    .map((e) => ({ e, y: yieldNumerico(e.ticker) }))
    .filter((x) => x.y != null && x.y > 0)
    .sort((a, b) => b.y - a.y)
    .slice(0, 5)
  const lineas = ['Los yields más altos registrados ahora (dato, NO recomendación — un yield altísimo suele esconder un pago extraordinario o un precio castigado):']
  for (const { e, y } of top) {
    lineas.push(`💰 ${e.nombreCorto} (${e.ticker}): ${y.toFixed(1)}%${y > 20 ? ' ⚠ probable extraordinario' : ''}`)
  }
  lineas.push('Antes de emocionarte con un yield, pregúntame «¿qué riesgos tiene…?» esa empresa.')
  return { texto: lineas.join('\n'), chips: ['¿Qué es el yield?', '¿Qué es un dividendo extraordinario?', '¿Qué es el payout?'] }
}

function respuestaEmpezar() {
  return {
    texto: [
      'Para empezar en la bolsa sin quemarte, este es el camino que enseñamos en ALTO:',
      '1️⃣ Aprende el idioma: en el Glosario están los términos clave explicados en simple (empieza por dividendo, P/E y deuda neta).',
      '2️⃣ Haz el quiz de la app: 4 preguntas y te muestro empresas que encajan con tu perfil — para ESTUDIARLAS, no para comprarlas a ciegas.',
      '3️⃣ Elige 2-3 empresas y síguelas con ★: lee su tesis, sus tips y sus hechos de importancia 📰 unas semanas antes de mover un sol.',
      '4️⃣ Para operar de verdad necesitas una SAB (agente de bolsa regulado por la SMV) — la app no vende nada ni intermedia.',
      'Regla de la casa: aquí se educa, NUNCA se recomienda comprar. El mercado manda.',
    ].join('\n'),
    chips: ['¿Qué es un dividendo?', '¿Qué es el P/E?', '¿Qué es una SAB?'],
  }
}

function respuestaRegla9() {
  return {
    texto: [
      'Esa es la única pregunta que NO voy a responder, y es a propósito 🙂.',
      'ALTO educa, no recomienda (Regla de Oro #9): nadie honesto puede prometerte qué acción "va a subir". Lo que sí puedo: darte los datos verificados de cualquiera de las ' + EMPRESAS.length + ' empresas (precio, P/E, dividendos, tesis, riesgos, noticias) para que TÚ decidas con criterio.',
      'Si no sabes por dónde empezar, el quiz te sugiere empresas según tu perfil — para estudiarlas.',
    ].join('\n'),
    chips: ['¿Cómo empiezo en la bolsa?', 'Ver quién paga más dividendos', '¿Qué es el P/E?'],
  }
}

function respuestaBienvenida() {
  return {
    texto: [
      '¡Hola! Soy **Yachay** (significa "saber" en quechua), la IA de ALTO Research — versión beta.',
      'Sé TODO lo que hay en esta app: las ' + EMPRESAS.length + ' empresas de la BVL (precios, P/E, dividendos, tesis, riesgos, hechos de importancia) y ' + TERMINOS.length + '+ términos de bolsa explicados en simple.',
      'Solo hablo de eso — no invento, no me salgo del tema y jamás te diré qué comprar. Pregúntame algo:',
    ].join('\n'),
    chips: ['¿Qué hace Buenaventura?', '¿Qué es un dividendo?', '¿Cómo empiezo en la bolsa?', 'Ver quién paga más dividendos'],
  }
}

function respuestaFallback(q) {
  const parecidas = buscarEmpresas(q, 3)
  const lineas = ['Esa no la sé — y prefiero decírtelo a inventar una respuesta 🙂.',
    'Solo sé de la Bolsa de Valores de Lima: sus empresas y los términos para entenderlas.']
  const chips = parecidas.length > 0
    ? parecidas.map((e) => `¿Qué hace ${e.nombreCorto}?`)
    : ['¿Qué hace Buenaventura?', '¿Qué es un dividendo?', '¿Cómo empiezo en la bolsa?']
  return { texto: lineas.join('\n'), chips }
}

// ── el despachador principal ─────────────────────────────────────────────
export function responder(pregunta) {
  const q = norm(pregunta)
  if (!q) return respuestaBienvenida()

  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|hi)\b/.test(q) && q.length < 30) {
    return respuestaBienvenida()
  }
  if (/(que (me )?recomiendas|recomienda|que compro|debo comprar|en que invierto|donde invierto|cual es la mejor|va a subir|conviene comprar|compro)/.test(q)) {
    return respuestaRegla9()
  }

  const empresas = buscarEmpresas(q)
  const e = empresas[0]

  // comparar dos empresas → mandarlo al Comparador
  if (empresas.length === 2 && /(compara|comparar|versus|vs|contra|o mejor)/.test(q)) {
    return {
      texto: `Buen duelo: **${empresas[0].nombreCorto}** vs **${empresas[1].nombreCorto}**. Para eso está el Comparador — carrera de precios, duelo de dividendos y tesis lado a lado.`,
      accion: { hash: `#/comparar/${empresas[0].ticker}/${empresas[1].ticker}`, label: '⚔️ Abrir el duelo en el Comparador' },
      chips: [`¿Qué hace ${empresas[0].nombreCorto}?`, `¿Qué hace ${empresas[1].nombreCorto}?`],
    }
  }

  if (e) {
    if (/(dividendo|yield|reparte|paga|pagos)/.test(q)) return respuestaDividendos(e)
    if (/(riesgo|peligro|malo|debilidad|cuidado|problema)/.test(q)) return respuestaRiesgos(e)
    if (/(noticia|hecho|novedad|comunicado|paso algo|ultimas|ultimo)/.test(q)) return respuestaHechos(e)
    if (/(precio|cotiza|cuanto (vale|cuesta)|cierre|barata|cara|p\/e|per\b)/.test(q)) return respuestaPrecio(e)
    return respuestaResumen(e)
  }

  if (/(quien|cual(es)?) .*(mas|mejores) dividendos|mayor yield|mas paga/.test(q) || /dividendos mas altos/.test(q)) {
    return respuestaTopDividendos()
  }
  if (/(como (empiezo|empezar|inicio|invierto)|primeros pasos|soy nuevo|desde cero|no se nada)/.test(q)) {
    return respuestaEmpezar()
  }

  const termino = buscarTermino(q)
  if (termino) {
    const lineas = [`📖 **${termino.clave[0].toUpperCase() + termino.clave.slice(1)}**: ${termino.def}`]
    if (termino.ej) lineas.push(`Ejemplo: ${termino.ej}`)
    return { texto: lineas.join('\n'), chips: ['¿Qué es el P/E?', '¿Qué es el yield?', '¿Cómo empiezo en la bolsa?'] }
  }

  if (/(que sabes|que puedes|quien eres|que eres|ayuda|como funcionas)/.test(q)) return respuestaBienvenida()

  return respuestaFallback(q)
}

export const PREGUNTAS_INICIALES = [
  '¿Qué hace Buenaventura?',
  '¿Qué es un dividendo?',
  '¿Cómo empiezo en la bolsa?',
  'Ver quién paga más dividendos',
  '¿Qué es el P/E?',
]
