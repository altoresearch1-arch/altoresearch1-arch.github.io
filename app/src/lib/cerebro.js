import empresasData from '../data/empresas.json'
import terminosData from '../data/terminos.json'
import glosarioData from '../data/glosario.json'
import tesisData from '../data/tesis.json'
import tipsData from '../data/tips.json'
import hechosData from '../data/hechos.json'
import conocimientoData from '../data/conocimiento.json'
import lecturasData from '../data/lecturas.json'
import gerenciaData from '../data/gerencia.json'
import notasData from '../data/notas.json'
import { redactarLectura, redactarGerencia } from './redactor'
import { precioDe, peInfo, dividendosDe, yieldNumerico } from './finanzas'
import { leerContexto, marcarContextoVisto, hechosAprendidos } from './sentinel'

// ─────────────────────────────────────────────────────────────────────────
// EL CEREBRO DE ATLAS — la IA de ALTO (beta). Enseña y aprende.
//
// ENSEÑA: no llama a ningún servidor ni API externa; responde SOLO con los
// datos verificados que ya viven en la app (114 empresas, 176 términos,
// tesis, tips, dividendos, hechos de importancia y el conocimiento curado
// de los INFORMES propios de ALTO — conocimiento.json). Por diseño no puede
// irse de tema ni inventar cifras — si no sabe, lo dice (Regla de Oro #1) —
// y NUNCA recomienda comprar (Regla #9).
// APRENDE: las preguntas que no sabe responder se pueden enviar al equipo
// con un toque (pestaña Comentarios) y se guardan en localStorage; con cada
// actualización, Jair las convierte en conocimiento nuevo.
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
  'grupo', 'empresa', 'peruana', 'peruano', 'peru', 'lima', 'corp', 'holding', 'inversiones',
  'industrias', 'consorcio', 'financiera', 'seguros', 'andina', 'general', 'nacional', 'agraria',
  'agroindustrial', 'azucarera', 'electrica', 'electricidad', 'energia', 'internacional'])

const EMPRESAS = empresasData.empresas.map((e) => {
  const limpio = sinCola(e.nombre)
  // ≥4 letras: "Nexa" o "Auna" también cuentan (los nombres cortos existen)
  const palabras = norm(limpio).split(' ').filter((w) => w.length >= 4 && !GENERICAS.has(w))
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

const conocimientoDe = (t) => conocimientoData.conocimiento?.[t] || null

function chipsEmpresa(e) {
  const chips = [
    `¿${e.nombreCorto} paga dividendos?`,
    `¿Qué riesgos tiene ${e.nombreCorto}?`,
    `Últimas noticias de ${e.nombreCorto}`,
  ]
  if (conocimientoDe(e.ticker)) chips.unshift(`Cuéntame más de ${e.nombreCorto}`)
  if (gerenciaData.gerencia?.[e.ticker]?.frases?.length) chips.push(`¿Qué dice la gerencia de ${e.nombreCorto}?`)
  if (notasData.notas?.[e.ticker]?.actual?.frases?.length) chips.push(`¿Qué dicen las notas de ${e.nombreCorto}?`)
  if (notasData.notas?.[e.ticker]?.['2025-T4'] || notasData.notas?.[e.ticker]?.['2025-T1']) chips.push(`¿Cómo le fue a ${e.nombreCorto} en 2025?`)
  return chips.slice(0, 5)
}

// Guardar la pregunta sin respuesta (APRENDER): queda en el navegador del
// usuario y la pestaña Comentarios la ofrece para enviarla al equipo.
export function anotarPreguntaSinRespuesta(pregunta) {
  try {
    const clave = 'alto-atlas-sin-respuesta'
    const lista = JSON.parse(localStorage.getItem(clave)) || []
    if (!lista.includes(pregunta)) lista.push(pregunta)
    localStorage.setItem(clave, JSON.stringify(lista.slice(-20)))
  } catch { /* sin storage no pasa nada */ }
}

// ── respuestas por intención ─────────────────────────────────────────────

function respuestaResumen(e) {
  const saber = conocimientoDe(e.ticker)
  const lineas = [
    `🏢 **${e.nombreCorto}** (${e.ticker}) — sector ${SECTOR_LEGIBLE[e.sector] || e.sector}.`,
    lineaPrecio(e.ticker),
    lineaPE(e.ticker),
    lineaDividendos(e.ticker),
    tesisDe(e.ticker) ? `🧭 Tesis ALTO: ${tesisDe(e.ticker)}` : null,
    saber ? `📚 Del informe ALTO: ${saber.datos[0]}` : (tipsDe(e.ticker)[0] ? `💡 Para entenderla: ${tipsDe(e.ticker)[0]}` : null),
    lineaHecho(e.ticker),
  ].filter(Boolean)
  // la voz de la propia gerencia (charla trimestral de la SMV)
  const g = gerenciaData.gerencia?.[e.ticker]
  if (g?.frases?.[0]) lineas.push(`🗣 La gerencia (${String(g.periodo || '').replace('-T', ' T')}): «${g.frases[0].slice(0, 180)}»`)
  // si el usuario me pasó hechos de ESTA empresa por Sentinel, los recuerdo
  const leidos = hechosAprendidos().filter((h) => h.ticker === e.ticker)
  if (leidos.length > 0) {
    const u = leidos[leidos.length - 1]
    lineas.push(`🛰️ Además me pasaste un hecho suyo por Sentinel (${u.cuando}): ${u.categoria} → ${VEREDICTO_TXT[u.veredicto] || u.veredicto}.`)
  }
  return {
    texto: lineas.join('\n'),
    ticker: e.ticker,
    chips: chipsEmpresa(e),
  }
}

// "Cuéntame más de X" — el conocimiento curado de los INFORMES propios de ALTO
// (los que Jair arma a mano desde las notas SMV). Solo hechos, cero recomendación.
function respuestaInforme(e) {
  const saber = conocimientoDe(e.ticker)
  if (!saber) return respuestaResumen(e)
  const lineas = [`Lo que ALTO investigó a fondo sobre **${e.nombreCorto}** (${saber.fuente}):`]
  saber.datos.forEach((d) => lineas.push(`📚 ${d}`))
  return {
    texto: lineas.join('\n'),
    ticker: e.ticker,
    chips: [`¿Qué riesgos tiene ${e.nombreCorto}?`, `¿${e.nombreCorto} paga dividendos?`, `Últimas noticias de ${e.nombreCorto}`],
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
  const RIESGO_RE = /(riesgo|deuda|cae|caida|ojo|cuidado|depende|volatil|ciclo|apalanc|perdida|negativo|sunat|juicio|conflicto|suspend|concentra|bandera)/i
  const avisos = tipsDe(e.ticker).filter((t) => RIESGO_RE.test(t)).slice(0, 3)
  for (const a of avisos) lineas.push(`⚠ ${a}`)
  const saber = conocimientoDe(e.ticker)
  if (saber) {
    for (const d of saber.datos.filter((x) => RIESGO_RE.test(x)).slice(0, 2)) lineas.push(`📚 ${d}`)
  }
  if (lineas.length === 1) lineas.push('No tengo riesgos específicos registrados; revisa su ficha completa y sus hechos de importancia 📰.')
  return { texto: lineas.join('\n'), ticker: e.ticker, chips: [`¿Qué hace ${e.nombreCorto}?`, `Últimas noticias de ${e.nombreCorto}`, '¿Qué es la deuda neta?'] }
}

// lectura pre-hecha por el ROBOT (gen_lecturas.py) del PDF de un hecho
const lecturaDe = (pdf) => {
  const l = pdf && lecturasData.lecturas?.[pdf]
  return l && !l.escaneado && !l.ilegible ? l : null
}

function respuestaHechos(e) {
  const hs = hechosDe(e.ticker).slice(0, 3)
  if (hs.length === 0) {
    return { texto: `No tengo hechos de importancia recientes de **${e.nombreCorto}** en mi registro (últimos 12 meses de la BVL).`, ticker: e.ticker, chips: chipsEmpresa(e) }
  }
  const lineas = [`Últimos hechos de importancia de **${e.nombreCorto}** (comunicados oficiales a la BVL):`]
  for (const h of hs) {
    const lec = lecturaDe(h.pdf)
    const emoji = lec ? ({ buena: ' 🟢', mala: ' 🔴', neutra: ' 🟡' })[lec.veredicto] : ''
    lineas.push(`📰 ${h.fecha} · ${h.categoria}${h.titulo ? ' — ' + h.titulo : ''}${emoji}`)
  }
  // el robot ya LEYÓ los PDF más recientes: sumar su lectura (esto es lo aprendido)
  const conLectura = hs.map((h) => ({ h, lec: lecturaDe(h.pdf) })).find((x) => x.lec)
  if (conLectura) {
    const { lec } = conLectura
    lineas.push(`🛰️ Ya leí el del ${conLectura.h.fecha}: ${VEREDICTO_TXT[lec.veredicto]}${lec.razones?.length ? ` (${lec.razones[0].replace(/^🟢 |^🔴 /, '')})` : ''}.`)
    if (lec.frases?.[0]) lineas.push(`📄 «${lec.frases[0].slice(0, 200)}»`)
  }
  lineas.push('En su ficha están todos, con el PDF oficial de cada uno (🟢🔴🟡 = mi lectura automática).')
  return { texto: lineas.join('\n'), ticker: e.ticker, chips: [`¿Qué hace ${e.nombreCorto}?`, '¿Qué es un hecho de importancia?'] }
}

// 📝 "¿qué dicen las notas de X?" — Notas a los EEFF digeridas (notas.json, SMV)
function respuestaNotas(e) {
  const n = notasData.notas?.[e.ticker]?.actual
  if (!n?.frases?.length) {
    return {
      texto: `Todavía no tengo las Notas a los Estados Financieros de **${e.nombreCorto}** digeridas (se extraen de la SMV cada trimestre; algunas llegan escaneadas).`,
      ticker: e.ticker,
      chips: chipsEmpresa(e),
    }
  }
  const lineas = [
    `Las **Notas a los Estados Financieros** son donde ${e.nombreCorto} EXPLICA sus números (deudas, juicios, partes relacionadas). De las del ${String(n.periodo || '').replace('-T', ' T')} (${n.paginas} páginas), esto es lo que subrayé:`,
  ]
  for (const f of n.frases.slice(0, 4)) lineas.push(`📝 «${f}»`)
  lineas.push('Todo textual del documento oficial de la SMV.')
  return {
    texto: lineas.join('\n'),
    ticker: e.ticker,
    chips: [`¿Qué dice la gerencia de ${e.nombreCorto}?`, `¿Qué riesgos tiene ${e.nombreCorto}?`, '¿Qué es la deuda neta?'],
  }
}

// ⛏ "¿cómo le fue a X en 2025?" — solo minas: notas Q1-Q4 2025 + sus hechos del año
function respuestaMinera2025(e) {
  const reg = notasData.notas?.[e.ticker] || {}
  const trimestres = ['2025-T1', '2025-T2', '2025-T3', '2025-T4'].filter((k) => reg[k]?.frases?.length)
  const hechos2025 = Object.values(lecturasData.lecturas || {})
    .filter((l) => l.ticker === e.ticker && String(l.fecha || '').startsWith('2025') && !l.escaneado && !l.ilegible)
  if (trimestres.length === 0 && hechos2025.length === 0) {
    return {
      texto: `Aún no tengo la historia 2025 de **${e.nombreCorto}** cargada (notas trimestrales y hechos del año — se están cosechando de la SMV/BVL).`,
      ticker: e.ticker,
      chips: chipsEmpresa(e),
    }
  }
  const lineas = [`El 2025 de **${e.nombreCorto}**, contado por sus documentos oficiales:`]
  for (const k of trimestres) {
    lineas.push(`📅 **${k.replace('2025-T', 'Trimestre ')} 2025** (notas de ${reg[k].paginas} pág.): «${reg[k].frases[0].slice(0, 220)}»`)
  }
  if (hechos2025.length > 0) {
    const buenas = hechos2025.filter((l) => l.veredicto === 'buena')
    const malas = hechos2025.filter((l) => l.veredicto === 'mala')
    lineas.push(`📰 Comunicó ${hechos2025.length} hechos de importancia en 2025: ${buenas.length} 🟢 buenos, ${malas.length} 🔴 malos y ${hechos2025.length - buenas.length - malas.length} 🟡 rutinarios.`)
    const destacado = buenas[0] || malas[0]
    if (destacado) lineas.push(`El que destaco (${destacado.fecha}): ${destacado.categoria} → ${VEREDICTO_TXT[destacado.veredicto]}${destacado.frases?.[0] ? ` — «${destacado.frases[0].slice(0, 160)}»` : ''}`)
  }
  return {
    texto: lineas.join('\n'),
    ticker: e.ticker,
    chips: [`¿Qué dice la gerencia de ${e.nombreCorto}?`, `¿Qué dicen las notas de ${e.nombreCorto}?`, `¿Qué riesgos tiene ${e.nombreCorto}?`],
  }
}

// 🗣 "¿qué dice la gerencia de X?" — la charla trimestral (gerencia.json, SMV)
function respuestaGerencia(e) {
  const g = gerenciaData.gerencia?.[e.ticker]
  if (!g?.frases?.length) {
    return {
      texto: `Todavía no tengo la charla de la gerencia de **${e.nombreCorto}** (se extrae de la SMV cada trimestre; algunas empresas no la presentan o llega escaneada).`,
      ticker: e.ticker,
      chips: chipsEmpresa(e),
    }
  }
  const lineas = [redactarGerencia(e.nombreCorto, g)]
  for (const f of g.frases.slice(0, 4)) lineas.push(`🗣 «${f}»`)
  lineas.push('Todo textual del documento oficial — la versión completa está en la SMV.')
  return {
    texto: lineas.join('\n'),
    ticker: e.ticker,
    chips: [`¿Qué riesgos tiene ${e.nombreCorto}?`, `Últimas noticias de ${e.nombreCorto}`, '¿Qué es el margen neto?'],
  }
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
      '¡Hola! Soy **Atlas**, la IA de ALTO Research — versión beta. **Enseño y aprendo.**',
      'ENSEÑO con lo que hay en esta app: las ' + EMPRESAS.length + ' empresas de la BVL (precios, P/E, dividendos, tesis, riesgos, hechos de importancia), ' + TERMINOS.length + '+ términos explicados en simple y el conocimiento de los informes propios de ALTO.',
      'Y APRENDO: si me preguntas algo que aún no sé, puedes mandárselo al equipo con un toque — en la siguiente actualización ya lo sabré.',
      'Solo hablo de la bolsa peruana — no invento y jamás te diré qué comprar. Pregúntame algo:',
    ].join('\n'),
    chips: ['¿Qué hace Buenaventura?', 'Cuéntame más de Backus', '¿Cómo empiezo en la bolsa?', 'Ver quién paga más dividendos'],
  }
}

function respuestaFallback(q, original) {
  anotarPreguntaSinRespuesta(original)
  const parecidas = buscarEmpresas(q, 3)
  const lineas = ['Esa todavía no la sé — y prefiero decírtelo a inventar una respuesta 🙂.',
    'Pero así APRENDO: mándasela al equipo de ALTO con el botón de abajo y en la siguiente actualización ya la sabré.']
  const chips = parecidas.length > 0
    ? parecidas.map((e) => `¿Qué hace ${e.nombreCorto}?`)
    : ['¿Qué hace Buenaventura?', '¿Qué es un dividendo?', '¿Cómo empiezo en la bolsa?']
  return {
    texto: lineas.join('\n'),
    aprender: original, // Atlas.jsx muestra el botón "enviar al equipo"
    chips,
  }
}

// ── 🛰️ el documento que Sentinel le pasó a Atlas (sessionStorage) ────────

const VEREDICTO_TXT = {
  buena: '🟢 pinta a BUENA noticia',
  mala: '🔴 pinta a MALA noticia',
  neutra: '🟡 pinta neutra / administrativa',
}

const chipsDoc = (doc) => [
  '¿Es buena o mala noticia?',
  ...(doc.preguntas || ['¿Qué montos menciona el documento?']),
  ...(doc.ticker ? [`¿Qué hace ${sinCola(doc.empresa || doc.ticker)}?`] : []),
].slice(0, 4)

// los datos que pescaron los extractores especializados, en líneas legibles
function lineasDetalles(doc) {
  const d = doc.detalles || {}
  const lineas = []
  if (d.instrumento) lineas.push(`🛡 Instrumento de cobertura: ${d.instrumento}.`)
  if (d.nocional?.length) lineas.push(`⚖ Cantidades cubiertas: ${d.nocional.join(' · ')}.`)
  if (d.resultadoAcumulado) lineas.push(`💰 Resultado acumulado del año con estos contratos: ${d.resultadoAcumulado}.`)
  if (d.porAccion) lineas.push(`💰 Dividendo: ${d.porAccion} por acción.`)
  if (d.fechaRegistro) lineas.push(`📅 Fecha de registro (quién cobra): ${d.fechaRegistro}.`)
  if (d.fechaEntrega) lineas.push(`📅 Fecha de entrega/pago: ${d.fechaEntrega}.`)
  return lineas
}

function respDocResumen(doc) {
  // el REDACTOR compone el párrafo con los datos extraídos (sin inventar)
  const lineas = [
    redactarLectura(doc),
    `Mi lectura: ${VEREDICTO_TXT[doc.veredicto]}.`,
  ]
  for (const f of (doc.frases || []).slice(0, 2)) lineas.push(`📄 «${f}»`)
  lineas.push('Recuerda: leo por palabras y patrones (beta) — dale una leída tú también.')
  return { texto: lineas.join('\n'), ticker: doc.ticker || undefined, chips: chipsDoc(doc) }
}

function respDocVeredicto(doc) {
  const lineas = [`Mi lectura del documento: ${VEREDICTO_TXT[doc.veredicto]}.`]
  if (doc.razones?.length) {
    lineas.push('Por qué lo digo:')
    for (const r of doc.razones) lineas.push(`· ${r}`)
  } else {
    lineas.push('No encontré señales fuertes en ningún sentido (suele pasar con los comunicados rutinarios).')
  }
  lineas.push('Esto NO es recomendación: es un resaltado automático para que sepas con qué ánimo leerlo.')
  return { texto: lineas.join('\n'), ticker: doc.ticker || undefined, chips: ['¿De qué trata el documento?', '¿Qué montos menciona el documento?'] }
}

function respDocDatos(doc, tipo) {
  const lista = tipo === 'montos' ? doc.montos : doc.fechas
  const icono = tipo === 'montos' ? '💵' : '📅'
  if (!lista?.length) {
    return { texto: `No encontré ${tipo} claros en el documento — puede que sea un comunicado sin cifras.`, chips: chipsDoc(doc) }
  }
  return {
    texto: [`${icono} ${tipo === 'montos' ? 'Montos' : 'Fechas'} que encontré en el documento:`, ...lista.map((x) => `· ${x}`)].join('\n'),
    chips: chipsDoc(doc),
  }
}

// búsqueda libre DENTRO del texto del documento (repreguntas)
function buscarEnDoc(doc, q) {
  const palabras = q.split(' ').filter((w) => w.length >= 5)
  if (!palabras.length || !doc.texto) return null
  const oraciones = doc.texto.split(/(?<=[.;])\s+|\n+/).filter((o) => o.length >= 30)
  let mejor = null
  for (const o of oraciones) {
    const oN = norm(o)
    const aciertos = palabras.filter((w) => oN.includes(w)).length
    if (aciertos > 0 && (!mejor || aciertos > mejor.aciertos)) mejor = { o: o.trim(), aciertos }
  }
  if (!mejor || mejor.aciertos < 1) return null
  return {
    texto: [`📄 En el documento encontré esto relacionado:`, `«${mejor.o.slice(0, 300)}»`].join('\n'),
    chips: chipsDoc(doc),
  }
}

// Saludo especial cuando Sentinel ACABA de pasarle un documento (Atlas.jsx lo
// usa al montar el chat). Devuelve null si no hay documento nuevo.
// PURO a propósito: NO marca el contexto como visto (StrictMode corre los
// inicializadores 2 veces en dev y la 2ª lo encontraba "usado") — Atlas.jsx
// lo marca en un useEffect al montar.
export function saludoSentinel() {
  const doc = leerContexto()
  if (!doc?.nuevo) return null
  const lineas = [
    `🛰️ **Sentinel me pasó un documento** y ya lo leí${doc.paginasLeidas ? ` (${doc.paginasLeidas} página${doc.paginasLeidas === 1 ? '' : 's'})` : ''}.`,
    `${doc.empresa ? `Es de **${doc.empresa}**` : 'No identifiqué la empresa con certeza'} · ${doc.categoria}.`,
    `Mi lectura rápida: ${VEREDICTO_TXT[doc.veredicto]}.`,
    'Pregúntame sobre él — o sobre cualquier otra cosa de la bolsa.',
  ]
  return {
    texto: lineas.join('\n'),
    ticker: doc.ticker || undefined,
    chips: ['¿De qué trata el documento?', ...chipsDoc(doc).slice(0, 3)],
  }
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

  // 🛰️ ¿Hay un documento que Sentinel le pasó? Responder sobre ÉL cuando la
  // pregunta lo menciona (o cuando no menciona ninguna empresa concreta).
  const doc = leerContexto()
  const hablaDelDoc = /(documento|el hecho|el pdf|la noticia|lo que leiste|lo que te paso|sentinel)/.test(q)
  if (doc && (hablaDelDoc || !e)) {
    if (/(de que trata|resume|resumen|que dice)/.test(q)) return respDocResumen(doc)
    if (/(buena|mala|como pinta|positiv|negativ)/.test(q) && /(noticia|documento|hecho|pinta)/.test(q)) return respDocVeredicto(doc)
    // los datos que pescaron los extractores especializados
    if (/(ganado|perdido|gano|perdio|resultado).{0,30}(derivad|cobertura|contrato)/.test(q) || /derivad.{0,30}(resultado|ganancia|perdida)/.test(q)) {
      const d = doc.detalles || {}
      if (d.resultadoAcumulado || d.instrumento || d.nocional) {
        return { texto: ['Lo que dice el documento sobre sus coberturas:', ...lineasDetalles(doc)].join('\n'), chips: chipsDoc(doc) }
      }
    }
    if (/(cuanto paga|por accion|fecha de (registro|entrega|pago))/.test(q) && (doc.detalles?.porAccion || doc.detalles?.fechaRegistro)) {
      return { texto: ['Lo que dice el documento sobre el reparto:', ...lineasDetalles(doc)].join('\n'), chips: chipsDoc(doc) }
    }
    if (/(monto|cifra|cuanto|cantidad|plata|dinero)/.test(q) && hablaDelDoc) return respDocDatos(doc, 'montos')
    if (/fecha/.test(q) && hablaDelDoc) return respDocDatos(doc, 'fechas')
    if (hablaDelDoc) return respDocResumen(doc)
  }

  // "¿qué hechos te he pasado?" — la memoria local de Sentinel
  if (/(que (hechos|documentos) (te|he)|que has (aprendido|leido)|que aprendiste)/.test(q)) {
    const lista = hechosAprendidos()
    if (lista.length === 0) {
      return { texto: 'Todavía no me has pasado ningún hecho de importancia por Sentinel. En la ficha de cualquier empresa, abajo de sus hechos 📰, está el recuadro 🛰️ para soltarme un PDF.', chips: PREGUNTAS_INICIALES.slice(0, 3) }
    }
    const lineas = ['Esto es lo que me has pasado por Sentinel (lo recuerdo en TU navegador):']
    for (const h of lista.slice(-6).reverse()) {
      lineas.push(`🛰️ ${h.cuando} · ${h.empresa || 'empresa no identificada'} · ${h.categoria} → ${VEREDICTO_TXT[h.veredicto] || h.veredicto}`)
    }
    return { texto: lineas.join('\n'), chips: ['¿De qué trata el documento?', '¿Qué hace Buenaventura?'] }
  }

  // comparar dos empresas → mandarlo al Comparador
  if (empresas.length === 2 && /(compara|comparar|versus|vs|contra|o mejor)/.test(q)) {
    return {
      texto: `Buen duelo: **${empresas[0].nombreCorto}** vs **${empresas[1].nombreCorto}**. Para eso está el Comparador — carrera de precios, duelo de dividendos y tesis lado a lado.`,
      accion: { hash: `#/comparar/${empresas[0].ticker}/${empresas[1].ticker}`, label: '⚔️ Abrir el duelo en el Comparador' },
      chips: [`¿Qué hace ${empresas[0].nombreCorto}?`, `¿Qué hace ${empresas[1].nombreCorto}?`],
    }
  }

  if (e) {
    if (/(2025|ano pasado)/.test(q) && /(como le fue|que paso|historia|resumen|hechos|notas)/.test(q)) return respuestaMinera2025(e)
    if (/(notas? (a|de) los estados|que dicen las notas|las notas de)/.test(q)) return respuestaNotas(e)
    if (/(gerencia|charla|analisis y discusion|como le fue|que dice la (empresa|gerencia))/.test(q)) return respuestaGerencia(e)
    if (/(cuentame mas|mas datos|a fondo|el informe|profundiza|que mas sabes)/.test(q)) return respuestaInforme(e)
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
    // siglas cortas (SAB, P/E, ETF…) van en mayúsculas; el resto solo capitaliza
    const titulo = termino.clave.length <= 4
      ? termino.clave.toUpperCase()
      : termino.clave[0].toUpperCase() + termino.clave.slice(1)
    const lineas = [`📖 **${titulo}**: ${termino.def}`]
    if (termino.ej) lineas.push(`Ejemplo: ${termino.ej}`)
    return { texto: lineas.join('\n'), chips: ['¿Qué es el P/E?', '¿Qué es el yield?', '¿Cómo empiezo en la bolsa?'] }
  }

  if (/(que sabes|que puedes|quien eres|que eres|ayuda|como funcionas|como aprendes)/.test(q)) return respuestaBienvenida()

  // último recurso antes de rendirse: ¿la respuesta está DENTRO del documento de Sentinel?
  if (doc) {
    const enDoc = buscarEnDoc(doc, q)
    if (enDoc) return enDoc
  }

  return respuestaFallback(q, pregunta)
}

export const PREGUNTAS_INICIALES = [
  '¿Qué hace Buenaventura?',
  '¿Qué es un dividendo?',
  '¿Cómo empiezo en la bolsa?',
  'Ver quién paga más dividendos',
  '¿Qué es el P/E?',
]
