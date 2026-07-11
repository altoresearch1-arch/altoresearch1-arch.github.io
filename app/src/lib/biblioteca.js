import { analizar, partirOraciones } from './sentinel'
import { leerArchivo } from './lectores'

// ─────────────────────────────────────────────────────────────────────────
// 📚 LA BIBLIOTECA DE SENTINEL — varios documentos a la vez, estilo NotebookLM.
//
// El usuario carga PDF/Word/Excel/PowerPoint/TXT/fotos y Atlas responde SOLO
// con lo que dicen esos documentos, CITANDO la fuente exacta (documento +
// página o sección). Pipeline completo EN el navegador (arquitectura en
// ARQUITECTURA_BIBLIOTECA.md): leer → trocear en chunks con ubicación →
// indexar (BM25 + sinónimos financieros ES/EN) → recuperar → responder
// extractivo. Sin servidores: el documento no sale del equipo del usuario.
//
// HONESTIDAD (Regla #1): la respuesta es siempre TEXTO DEL DOCUMENTO con su
// cita. Si el índice no encuentra nada, la respuesta es literalmente
// "No encontré esa información en los documentos." — jamás se inventa.
// ─────────────────────────────────────────────────────────────────────────

const CLAVE_BIB = 'alto-biblioteca'                 // sessionStorage: docs con chunks (sobrevive recarga)
const CLAVE_NUEVO = 'alto-biblioteca-nuevo'         // sessionStorage: "recién cargada" → Atlas saluda con ella
const CLAVE_HISTORIAL = 'alto-biblioteca-historial' // localStorage: nombres de docs leídos (memoria liviana)
const MAX_DOCS = 12
const MAX_CHUNK = 900      // caracteres por chunk (oraciones completas)
const MAX_CHUNKS_DOC = 300

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')

// ── almacén (singleton del módulo + persistencia best-effort) ─────────────

let docs = cargarGuardado()

function cargarGuardado() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_BIB))?.docs || []
  } catch { return [] }
}

function guardar() {
  try {
    sessionStorage.setItem(CLAVE_BIB, JSON.stringify({ docs }))
  } catch { /* doc muy grande para el storage: vive en memoria igual (se pierde al recargar) */ }
}

export const losDocumentos = () => docs

export function quitarDocumento(id) {
  docs = docs.filter((d) => d.id !== id)
  guardar()
}

export function vaciarBiblioteca() {
  docs = []
  guardar()
}

export function marcarBibliotecaNueva() {
  try { sessionStorage.setItem(CLAVE_NUEVO, '1') } catch { /* nada */ }
}

export function bibliotecaEsNueva() {
  try {
    if (sessionStorage.getItem(CLAVE_NUEVO) === '1' && docs.length > 0) return true
  } catch { /* nada */ }
  return false
}

export function marcarBibliotecaVista() {
  try { sessionStorage.removeItem(CLAVE_NUEVO) } catch { /* nada */ }
}

export function historialLeidos() {
  try { return JSON.parse(localStorage.getItem(CLAVE_HISTORIAL)) || [] } catch { return [] }
}

// ── agregar un documento: leer → chunks → métricas → análisis ─────────────

export async function agregarDocumento(archivo, onEstado) {
  if (docs.length >= MAX_DOCS) throw new Error('BIBLIOTECA_LLENA')
  const r = await leerArchivo(archivo, onEstado)
  onEstado?.('indexando el contenido…')
  const chunks = trocear(r.unidades)
  const doc = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nombre: archivo.name,
    tipo: r.tipo,
    paginas: r.paginas,
    ocr: r.ocr,
    agregado: new Date().toISOString().slice(0, 10),
    chunks,
    metricas: extraerMetricas(chunks),
    periodo: periodoDe(r.texto),
    analisis: recortarAnalisis(analizar(r.texto, archivo.name)),
  }
  docs = [...docs, doc]
  guardar()
  try {
    const h = historialLeidos().filter((x) => x.nombre !== doc.nombre)
    h.push({ nombre: doc.nombre, cuando: doc.agregado })
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(h.slice(-20)))
  } catch { /* nada */ }
  return doc
}

// del análisis de sentinel solo viaja lo liviano (el texto completo ya está en chunks)
function recortarAnalisis(a) {
  return { titulo: a.titulo, categoria: a.categoria, categoriaClave: a.categoriaClave,
    veredicto: a.veredicto, razones: a.razones, idioma: a.idioma, detalles: a.detalles }
}

// chunks "inteligentes": oraciones completas agrupadas, cada una con su ubicación
function trocear(unidades) {
  const chunks = []
  for (const u of unidades || []) {
    const oraciones = partirOraciones(String(u.texto || '').replace(/\n+/g, ' '))
    let actual = ''
    const cerrar = () => {
      if (actual.trim().length >= 30) chunks.push({ texto: actual.trim(), pagina: u.pagina || null, seccion: u.seccion || null })
      actual = ''
    }
    for (const o of oraciones) {
      if (actual && (actual.length + o.length) > MAX_CHUNK) cerrar()
      actual += (actual ? ' ' : '') + (o.length > MAX_CHUNK ? o.slice(0, MAX_CHUNK) : o)
    }
    cerrar()
    if (chunks.length >= MAX_CHUNKS_DOC) break
  }
  return chunks.slice(0, MAX_CHUNKS_DOC)
}

// ── la CITA exacta (el formato que pidió Jair) ────────────────────────────

export function cita(doc, chunk) {
  const partes = [doc.nombre]
  if (chunk?.seccion) {
    partes.push(/^(hoja|diapositiva)/i.test(chunk.seccion) ? chunk.seccion : `Sección «${chunk.seccion}»`)
  } else if (chunk?.pagina) {
    partes.push(`Página ${chunk.pagina}`)
  }
  if (doc.ocr) partes.push('OCR')
  return partes.join(' · ')
}

// ── búsqueda "semántica ligera": BM25 + sinónimos financieros ES/EN ───────

const STOP = new Set(['que', 'los', 'las', 'del', 'con', 'por', 'para', 'una', 'unos', 'unas',
  'este', 'esta', 'estos', 'estas', 'como', 'donde', 'cuando', 'cual', 'cuales', 'cuanto', 'cuanta',
  'the', 'and', 'for', 'with', 'that', 'this', 'was', 'are', 'has', 'have', 'sobre', 'entre',
  'documento', 'documentos', 'dice', 'dicen', 'menciona', 'segun', 'acerca', 'informe', 'informes'])

// cada grupo son EQUIVALENTES: preguntar por uno encuentra los otros (ES ↔ EN)
const SINONIMOS = [
  ['utilidad', 'ganancia', 'beneficio', 'income', 'profit', 'earnings', 'resultado'],
  ['ingresos', 'ventas', 'revenue', 'revenues', 'sales', 'facturacion'],
  ['deuda', 'endeudamiento', 'debt', 'pasivo', 'apalancamiento', 'leverage'],
  ['ebitda'],
  ['flujo', 'efectivo', 'caja', 'cash'],
  ['dividendo', 'dividendos', 'dividend', 'dividends', 'reparto'],
  ['perdida', 'perdidas', 'loss', 'losses', 'deterioro', 'impairment'],
  ['riesgo', 'riesgos', 'risk', 'risks', 'contingencia', 'contingencias'],
  ['produccion', 'production', 'produjo', 'produced'],
  ['inversion', 'inversiones', 'capex', 'investment'],
  ['precio', 'precios', 'price', 'prices', 'cotizacion'],
  ['accion', 'acciones', 'share', 'shares', 'stock'],
  ['trimestre', 'quarter', 'trimestral', 'quarterly'],
  ['crecimiento', 'crecio', 'growth', 'aumento', 'increase', 'increased'],
  ['caida', 'cayo', 'decline', 'declined', 'decrease', 'disminucion', 'disminuyo'],
  ['juicio', 'demanda', 'litigio', 'lawsuit', 'litigation', 'arbitraje', 'arbitration'],
  ['compra', 'adquisicion', 'acquisition', 'venta', 'sale', 'fusion', 'merger'],
  ['mina', 'minas', 'mine', 'mines', 'yacimiento', 'proyecto', 'project'],
  ['cobre', 'copper'], ['oro', 'gold'], ['plata', 'silver'], ['zinc'],
  ['plomo', 'lead'], ['estano', 'tin'], ['hierro', 'iron'], ['litio', 'lithium'],
]
const GRUPO_DE = new Map()
SINONIMOS.forEach((grupo, i) => grupo.forEach((w) => GRUPO_DE.set(w, i)))

function tokensDe(texto) {
  return norm(texto).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t))
}

// expande la pregunta: cada token se vuelve un GRUPO de equivalentes
function gruposDe(pregunta) {
  const grupos = []
  const vistos = new Set()
  for (const t of tokensDe(pregunta)) {
    const gi = GRUPO_DE.get(t)
    const clave = gi != null ? `g${gi}` : t
    if (vistos.has(clave)) continue
    vistos.add(clave)
    grupos.push(gi != null ? SINONIMOS[gi] : [t])
  }
  return grupos
}

export function buscarEnBiblioteca(pregunta, k = 3) {
  const grupos = gruposDe(pregunta)
  if (!grupos.length || !docs.length) return []
  const todos = docs.flatMap((d) => d.chunks.map((c) => ({ d, c, toks: null })))
  const N = todos.length || 1
  const largoProm = todos.reduce((s, x) => s + x.c.texto.length, 0) / N

  // df por grupo (en cuántos chunks aparece alguno de sus términos)
  const puntuados = []
  const dfs = grupos.map((g) => {
    let df = 0
    for (const x of todos) {
      const tN = norm(x.c.texto)
      if (g.some((w) => tN.includes(w))) df++
    }
    return df
  })
  for (const x of todos) {
    const tN = norm(x.c.texto)
    let puntos = 0
    let aciertos = 0
    let dfMin = Infinity // qué tan RARA es la palabra más específica que acertó
    grupos.forEach((g, i) => {
      const df = dfs[i]
      if (!df) return
      let tf = 0
      for (const w of g) tf += tN.split(w).length - 1
      if (!tf) return
      aciertos++
      dfMin = Math.min(dfMin, df)
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
      const k1 = 1.4, b = 0.6
      puntos += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * x.c.texto.length / largoProm))
    })
    // exigencia: 2 grupos hallados — o 1 solo si es palabra RARA en la
    // biblioteca (ej. "Boliden"): específica y certera. Evita respuestas al
    // voleo sin ponerse sordo a lo puntual.
    const esRara = dfMin <= Math.max(2, Math.ceil(N * 0.15))
    if (puntos > 0 && (aciertos >= 2 || (aciertos === 1 && esRara))) {
      puntuados.push({ doc: x.d, chunk: x.c, puntos, aciertos, gruposTotal: grupos.length })
    }
  }
  puntuados.sort((a, b) => b.puntos - a.puntos)
  // variedad: máximo 2 chunks del mismo documento en el top
  const top = []
  const porDoc = {}
  for (const p of puntuados) {
    porDoc[p.doc.id] = (porDoc[p.doc.id] || 0) + 1
    if (porDoc[p.doc.id] <= 2) top.push(p)
    if (top.length >= k) break
  }
  ultimaDiag = {
    vivos: grupos.filter((_, i) => dfs[i] > 0).map((g) => g[0]),
    muertos: grupos.filter((_, i) => dfs[i] === 0).map((g) => g[0]),
  }
  // rastro para "¿cómo lo supiste?" (explicación del razonamiento, trazable)
  anotarRazonamiento({
    tipo: 'busqueda', pregunta,
    docsRevisados: docs.length, chunksEvaluados: N,
    buscado: grupos.map((g) => g[0]),
    candidatos: puntuados.length,
    usados: top.map((t) => ({ cita: cita(t.doc, t.chunk), puntos: t.puntos.toFixed(1), aciertos: t.aciertos, gruposTotal: t.gruposTotal })),
  })
  return top
}

export const SIN_RESPUESTA = 'No encontré esa información en los documentos.'

// Respuesta HONESTA y matizada cuando no hay un dato que dar. Distingue:
//  (a) biblioteca vacía / nada relevante en ningún lado → el "No encontré…" seco;
//  (b) SÍ revisé documentos con menciones relacionadas pero el dato puntual no
//      está → lo digo explícito (pedido de Jair: no un "no sé" genérico).
// `queBuscaba` (opcional) = el indicador concreto que se buscó (ej. "EBITDA").
function sinDato(queBuscaba = null) {
  if (!docs.length) return { texto: SIN_RESPUESTA, sinRespuesta: true }
  const diag = ultimaDiag
  const hayPistas = diag && diag.vivos.length > 0
  const nDocs = docs.length
  // "tu documento" (1) vs "tus 3 documentos" (varios) — gramática correcta
  const cuantos = nDocs === 1 ? 'tu documento' : `tus ${nDocs} documentos`
  // nada relacionado aparece siquiera → sin fragmento relevante
  if (!queBuscaba && (!diag || diag.vivos.length === 0)) {
    return { texto: SIN_RESPUESTA, sinRespuesta: true }
  }
  const lineas = []
  if (queBuscaba) {
    lineas.push(`Revisé ${cuantos} y ${nDocs === 1 ? 'no menciona' : 'ninguno menciona'} ${queBuscaba} con una cifra. Esa información no está presente en lo que cargaste — no la invento.`)
  } else if (hayPistas) {
    lineas.push(`Revisé ${cuantos}: aparecen menciones de ${diag.vivos.slice(0, 4).join(', ')}, pero el dato puntual que preguntas no está escrito ahí. No lo invento.`)
    if (diag.muertos.length) lineas.push(`De lo que preguntaste, no encontré nada sobre: ${diag.muertos.slice(0, 4).join(', ')}.`)
  } else {
    return { texto: SIN_RESPUESTA, sinRespuesta: true }
  }
  lineas.push('Si crees que sí está, prueba con otras palabras o revisa que el documento correcto esté cargado 📚.')
  return { texto: lineas.join('\n'), sinDato: true }
}

// ── el ANALISTA: métricas financieras con cita ────────────────────────────

const RE_MONTO = String.raw`(?:(?:S\/\.?|US\$|USD|\$)\s?\(?-?[\d][\d,.]*\)?(?:\s?(?:millones|mill[oó]n|millions?|miles de|miles|mil|billions?|MM|bn))?|[\d][\d,.]*\s?(?:millones|mill[oó]n|millions?|billions?|MM|bn)\b)`

// Cada indicador declara su TIPO de valor: monto (con moneda/magnitud),
// porcentaje, ratio (P/E 12.5x) o cantidad física (onzas/toneladas) — así el
// extractor no pesca basura (un % donde va un monto, etc.).
const VALOR_POR_TIPO = {
  monto: RE_MONTO,
  pct: String.raw`[\d]{1,3}(?:\.\d+)?\s?%`,
  ratio: String.raw`[\d]{1,3}(?:\.\d+)?\s?x?\b`,
  cantidad: String.raw`[\d][\d,.]*\s?(?:millones de |miles de )?(?:onzas|oz|koz|moz|toneladas|tm[fhd]?\b|libras|lbs|barriles)`,
}

export const METRICAS = [
  { clave: 'ingresos', nombre: 'Ingresos / ventas', tipo: 'monto', re: String.raw`(?:ingresos(?: netos| totales| de actividades ordinarias)?|ventas(?: netas)?|total revenues?|revenues?|net sales)` },
  { clave: 'ebitda', nombre: 'EBITDA', tipo: 'monto', re: String.raw`(?:adjusted ebitda|ebitda(?: ajustado)?)` },
  { clave: 'utilidad', nombre: 'Utilidad neta', tipo: 'monto', re: String.raw`(?:utilidad neta|ganancia neta|resultado neto|p[eé]rdida neta|net (?:income|profit|loss|earnings))` },
  { clave: 'bpa', nombre: 'BPA (utilidad por acción)', tipo: 'monto', re: String.raw`(?:utilidad por acci[oó]n|p[eé]rdida por acci[oó]n|\bbpa\b|earnings per share|\beps\b)` },
  { clave: 'flujoLibre', nombre: 'Flujo de caja libre', tipo: 'monto', re: String.raw`(?:flujo de caja libre|free cash flow)` },
  { clave: 'flujo', nombre: 'Flujo de caja', tipo: 'monto', re: String.raw`(?:flujo de (?:caja|efectivo)(?: operativo)?|operating cash flow|cash flow (?:from|used in) operations)` },
  { clave: 'capex', nombre: 'CAPEX (inversión de capital)', tipo: 'monto', re: String.raw`(?:\bcapex\b|inversi[oó]n(?:es)? de capital|capital expenditures?)` },
  { clave: 'opex', nombre: 'OPEX (gastos operativos)', tipo: 'monto', re: String.raw`(?:\bopex\b|gastos? operativos?|operating expenses?)` },
  { clave: 'deuda', nombre: 'Deuda', tipo: 'monto', re: String.raw`(?:deuda(?: financiera| neta| total| bruta)?|total debt|net debt|gross debt)` },
  { clave: 'caja', nombre: 'Caja disponible', tipo: 'monto', re: String.raw`(?:caja disponible|efectivo y equivalentes(?: de efectivo)?|cash and cash equivalents)` },
  { clave: 'dividendoPagado', nombre: 'Dividendo', tipo: 'monto', re: String.raw`(?:dividendos?(?: en efectivo)?(?: por acci[oó]n)?|dividends? per share|cash dividends?)` },
  { clave: 'costos', nombre: 'Costo de producción', tipo: 'monto', re: String.raw`(?:cash cost|\baisc\b|all.in sustaining cost|costos? de producci[oó]n)` },
  { clave: 'margenBruto', nombre: 'Margen bruto', tipo: 'pct', re: String.raw`(?:margen bruto|gross margin)` },
  { clave: 'margenOperativo', nombre: 'Margen operativo', tipo: 'pct', re: String.raw`(?:margen operativo|operating margin)` },
  { clave: 'margenEbitda', nombre: 'Margen EBITDA', tipo: 'pct', re: String.raw`(?:margen ebitda|ebitda margin)` },
  { clave: 'margenNeto', nombre: 'Margen neto', tipo: 'pct', re: String.raw`(?:margen neto|net margin|profit margin)` },
  { clave: 'variacion', nombre: 'Variación interanual', tipo: 'pct', re: String.raw`(?:creci[oó]|aument[oó]|cay[oó]|disminuy[oó]|se redujo|increased|grew|rose|fell|declined|decreased|interanual|year.over.year|\byoy\b)` },
  { clave: 'pe', nombre: 'P/E', tipo: 'ratio', re: String.raw`(?:\bp\/e\b|price.to.earnings)` },
  { clave: 'evEbitda', nombre: 'EV/EBITDA', tipo: 'ratio', re: String.raw`(?:\bev\/ebitda\b)` },
  { clave: 'produccion', nombre: 'Producción', tipo: 'cantidad', re: String.raw`(?:producci[oó]n(?: de (?:oro|plata|cobre|zinc|plomo|esta[ñn]o|hierro|litio))?|production)` },
  { clave: 'reservas', nombre: 'Reservas', tipo: 'cantidad', re: String.raw`(?:reservas(?: minerales| probadas| probables)?|mineral reserves|proven and probable)` },
  { clave: 'recursos', nombre: 'Recursos minerales', tipo: 'cantidad', re: String.raw`(?:recursos minerales|mineral resources|measured and indicated)` },
]

function extraerMetricas(chunks) {
  const halladas = []
  for (const m of METRICAS) {
    // % y ratios van PEGADOS a su nombre (gap corto); los montos aguantan más texto
    const gap = m.tipo === 'monto' ? 80 : 40
    const re = new RegExp(`(${m.re})[^.\\n]{0,${gap}}?(${VALOR_POR_TIPO[m.tipo]})`, 'i')
    for (const c of chunks) {
      const hit = c.texto.match(re)
      if (!hit) continue
      const esPerdida = /p[eé]rdida|net loss/i.test(hit[1])
      halladas.push({
        clave: m.clave, nombre: m.nombre, tipo: m.tipo,
        etiqueta: hit[1].trim(), valorTexto: hit[2].trim().replace(/[.,]$/, ''),
        valorNum: montoANumero(hit[2]), esPerdida,
        pagina: c.pagina, seccion: c.seccion,
        frase: hit[0].slice(0, 160),
      })
      break // la primera aparición por documento suele ser la del estado principal
    }
  }
  return halladas
}

function montoANumero(txt) {
  const m = String(txt).match(/([\d][\d,.]*)/)
  if (!m) return null
  const num = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(num)) return null
  const escala = /bill|bn/i.test(txt) ? 1e9 : /mill|MM/i.test(txt) ? 1e6 : /miles|mil\b/i.test(txt) ? 1e3 : 1
  const signo = /\(|-/.test(txt) ? -1 : 1
  return num * escala * signo
}

const monedaDe = (txt) => /S\//.test(txt) ? 'S/' : /US\$|USD|\$/.test(txt) ? 'US$' : null

// el PERÍODO del documento ("2026-T1", "2025") para ordenar y comparar
function periodoDe(texto) {
  const t = texto.slice(0, 6000)
  let m = t.match(/\bQ([1-4])[\s-]?(20\d\d)/i)
  if (m) return `${m[2]}-T${m[1]}`
  m = t.match(/(primer|segundo|tercer|cuarto)\s+trimestre[^\d]{0,25}(20\d\d)/i)
  if (m) return `${m[2]}-T${({ primer: 1, segundo: 2, tercer: 3, cuarto: 4 })[m[1].toLowerCase()]}`
  const MES_T = { marzo: 1, march: 1, junio: 2, june: 2, setiembre: 3, septiembre: 3, september: 3, diciembre: 4, december: 4 }
  m = t.match(/(?:al|ended[^.]{0,15})\s+(?:el\s+)?3[01] (?:de )?(marzo|junio|setiembre|septiembre|diciembre|march|june|september|december)[^\d]{0,15}(20\d\d)/i)
  if (m) return `${m[2]}-T${MES_T[m[1].toLowerCase()]}`
  m = t.match(/(?:ejercicio|a[ñn]o|year ended)[^\d]{0,20}(20\d\d)/i)
  if (m) return m[1]
  return null
}

// ── 🕵️ LA SUPERVISORA — verificación programada antes de cada respuesta ──
// Atlas no es un LLM al que se le pueda dar un "prompt mental": es código.
// Así que la supervisión también es CÓDIGO que corre sobre cada respuesta de
// la biblioteca antes de entregarla: (1) ¿la evidencia es débil? avisar;
// (2) ¿el período del documento NO cuadra con el que preguntaron? avisar;
// (3) ¿otro documento contradice la cifra? avisar con ambas fuentes.
// Lo demás del checklist ya está por construcción: solo evidencia textual,
// cita siempre, orden por relevancia, y "No encontré…" si no está.
// La precisión tiene prioridad absoluta sobre la velocidad (pedido de Jair).

// el período que el usuario PREGUNTÓ ("…en el primer trimestre 2026?")
function periodoPreguntado(pregunta) {
  const q = norm(pregunta)
  let m = q.match(/\bq([1-4])[\s-]?(20\d\d)/)
  if (m) return `${m[2]}-T${m[1]}`
  m = q.match(/(primer|segundo|tercer|cuarto)\s+trimestre[^\d]{0,20}(20\d\d)/)
  if (m) return `${m[2]}-T${({ primer: 1, segundo: 2, tercer: 3, cuarto: 4 })[m[1]]}`
  m = q.match(/\b(20\d\d)\b/)
  if (m) return m[1]
  return null
}

// misma métrica + MISMO período + cifra distinta en dos documentos = contradicción
function contradiccionEn(clave) {
  const entradas = docs
    .map((d) => ({ d, hit: d.metricas.find((x) => x.clave === clave) }))
    // cantidades físicas no se comparan a ciegas (onzas vs toneladas)
    .filter((x) => x.hit && x.hit.valorNum != null && x.hit.tipo !== 'cantidad')
  for (let i = 0; i < entradas.length; i++) {
    for (let j = i + 1; j < entradas.length; j++) {
      const a = entradas[i], b = entradas[j]
      if (!a.d.periodo || a.d.periodo !== b.d.periodo) continue
      if (monedaDe(a.hit.valorTexto) !== monedaDe(b.hit.valorTexto)) continue
      const delta = (Math.abs(b.hit.valorNum - a.hit.valorNum) / Math.max(Math.abs(a.hit.valorNum), 1)) * 100
      if (delta > 2) {
        return `⚠ 🕵️ Supervisora: para el MISMO período (${legiblePeriodo(a.d.periodo)}) tus documentos dan cifras DISTINTAS de ${a.hit.nombre.toLowerCase()}: ${a.hit.valorTexto} (📎 ${a.d.nombre}) vs ${b.hit.valorTexto} (📎 ${b.d.nombre}). Revisa cuál es la fuente correcta antes de usar el dato.`
      }
    }
  }
  return null
}

// 📏 NIVEL DE CONFIANZA: porcentaje HONESTO (heurística declarada, no magia)
// con sus motivos — nº de fuentes, cobertura de la pregunta, contradicciones,
// si el texto vino de OCR y si el período cuadra con lo preguntado.
function lineaConfianza({ fuentes = 1, cobertura = null, contradiccion = false, periodoMal = false, conOcr = false }) {
  let pts = 55
  const motivos = []
  if (fuentes >= 2) { pts += 20; motivos.push(`${fuentes} fuentes coinciden`) } else { motivos.push('1 sola fuente') }
  if (cobertura != null) {
    if (cobertura >= 1) { pts += 15; motivos.push('cubre toda la pregunta') }
    else if (cobertura < 0.5) { pts -= 15; motivos.push('cubre solo parte de la pregunta') }
  }
  if (contradiccion) { pts -= 30; motivos.push('hay cifras contradictorias') }
  else if (fuentes >= 2) { pts += 5; motivos.push('sin contradicciones') }
  if (periodoMal) { pts -= 20; motivos.push('el período no es el preguntado') }
  if (conOcr) { pts -= 10; motivos.push('parte del texto salió de OCR') }
  pts = Math.max(25, Math.min(95, pts))
  return `📏 Confianza: ~${pts}% (${motivos.join(' · ')})`
}

// 🧾 EXPLICACIÓN DEL RAZONAMIENTO: cada respuesta de la biblioteca deja su
// rastro ("¿cómo lo supiste?" → Atlas muestra el paso a paso, trazable)
let ultimoRazonamiento = null
const anotarRazonamiento = (r) => { ultimoRazonamiento = r }

// diagnóstico de la última búsqueda: qué términos SÍ viven en los documentos
// y cuáles no aparecen ni una vez (distingue "no está el dato" de "no hay nada")
let ultimaDiag = null

export function explicarRazonamiento() {
  const r = ultimoRazonamiento
  if (!r) return null
  const lineas = ['🧾 Así llegué a mi última respuesta sobre tus documentos:']
  lineas.push(`1. Revisé ${r.docsRevisados} documento${r.docsRevisados === 1 ? '' : 's'} partido${r.docsRevisados === 1 ? '' : 's'} en ${r.chunksEvaluados} fragmentos indexados.`)
  if (r.tipo === 'busqueda') {
    lineas.push(`2. Busqué: ${r.buscado.join(', ')} — cada término con sus sinónimos en español e inglés.`)
    lineas.push(`3. ${r.candidatos} fragmento${r.candidatos === 1 ? ' pasó' : 's pasaron'} el filtro de relevancia; los demás se descartaron por no contener esos términos (o solo palabras muy comunes).`)
    for (const u of r.usados) {
      lineas.push(`4. Usé 📎 ${u.cita} — relevancia ${u.puntos}, acertó ${u.aciertos} de ${u.gruposTotal} término${u.gruposTotal === 1 ? '' : 's'} buscados.`)
    }
  } else {
    lineas.push(`2. Busqué los indicadores: ${r.buscado.join(', ')} — con patrones de analista (la cifra tiene que estar PEGADA al nombre del indicador, con su moneda o unidad).`)
    lineas.push(`3. Los encontré en: ${r.usados.join(' · ')}.`)
  }
  lineas.push('Regla de hierro: solo cito texto literal de tus documentos — lo que no está, no aparece.')
  return { texto: lineas.join('\n') }
}

// 🎛 PREFERENCIA DE FORMATO (corto/detallado): solo cambia la PRESENTACIÓN,
// jamás los hechos. Se guarda en el navegador del usuario.
const CLAVE_FORMATO = 'alto-atlas-formato'
export function fijarFormato(f) {
  try { localStorage.setItem(CLAVE_FORMATO, f) } catch { /* sin storage */ }
}
export function formatoPreferido() {
  try { return localStorage.getItem(CLAVE_FORMATO) || 'normal' } catch { return 'normal' }
}
const esCorto = () => formatoPreferido() === 'corto'

// corre las verificaciones y devuelve los avisos que correspondan
function supervisar({ pregunta, usados = [], claves = [] }) {
  const avisos = []
  const pp = periodoPreguntado(pregunta)
  if (pp) {
    const conPeriodo = usados.filter((d) => d.periodo)
    const cuadra = conPeriodo.some((d) => String(d.periodo).startsWith(pp) || pp.startsWith(String(d.periodo)))
    if (conPeriodo.length > 0 && !cuadra) {
      const vienenDe = [...new Set(conPeriodo.map((d) => legiblePeriodo(d.periodo)))].join(' y ')
      avisos.push(`🕵️ Supervisora: preguntaste por ${legiblePeriodo(pp)}, pero lo que encontré viene de ${vienenDe} — es OTRO período, tómalo con pinzas.`)
    }
  }
  for (const clave of claves) {
    const c = contradiccionEn(clave)
    if (c) avisos.push(c)
  }
  return [...new Set(avisos)]
}

// ── respuestas armadas (todas con cita, todas extractivas) ────────────────

const lineaCita = (doc, chunk) => `   📎 ${cita(doc, chunk)}`

export function respuestaBusqueda(pregunta) {
  const top = buscarEnBiblioteca(pregunta, esCorto() ? 1 : 3) // preferencia de formato
  // sin match: si había menciones relacionadas lo digo explícito; si no, el seco
  if (!top.length) return sinDato()
  const grupos = gruposDe(pregunta)
  const lineas = ['Esto es lo que dicen tus documentos (textual, con su fuente):']
  for (const { doc, chunk } of top) {
    // dentro del chunk ganador, citar la ORACIÓN que mejor responde
    let mejor = null
    for (const o of partirOraciones(chunk.texto)) {
      if (o.length < 25) continue
      const oN = norm(o)
      const hits = grupos.filter((g) => g.some((w) => oN.includes(w))).length
      if (hits > 0 && (!mejor || hits > mejor.hits)) mejor = { o, hits }
    }
    const citaTexto = (mejor?.o || chunk.texto).slice(0, 300)
    lineas.push(`📄 «${citaTexto}${(mejor?.o || chunk.texto).length > 300 ? '…' : ''}»`)
    lineas.push(lineaCita(doc, chunk))
  }
  // 🕵️ verificaciones: evidencia débil + período que no cuadra con la pregunta
  const mejor = top[0]
  if (mejor.gruposTotal >= 3 && mejor.aciertos <= Math.floor(mejor.gruposTotal / 2)) {
    lineas.push('🕵️ Supervisora: tu pregunta tiene más elementos de los que logré juntar en un solo pasaje — esto es lo MÁS CERCANO que hay; puede no responderla completa.')
  }
  const avisos = supervisar({ pregunta, usados: top.map((t) => t.doc) })
  lineas.push(...avisos)
  lineas.push(lineaConfianza({
    fuentes: new Set(top.map((t) => t.doc.id)).size,
    cobertura: mejor.aciertos / mejor.gruposTotal,
    contradiccion: avisos.some((a) => a.includes('DISTINTAS')),
    periodoMal: avisos.some((a) => a.includes('OTRO período')),
    conOcr: top.some((t) => t.doc.ocr),
  }))
  return { texto: lineas.join('\n') }
}

// qué indicadores pide la pregunta (una intención puede abrir varias claves)
const INTENCION_METRICA = [
  [/(ingreso|venta|revenue|sales|facturacion)/, ['ingresos']],
  [/margen/, ['margenBruto', 'margenOperativo', 'margenEbitda', 'margenNeto']],
  [/ev\/ebitda/, ['evEbitda']],
  [/ebitda/, ['ebitda', 'margenEbitda']],
  [/(utilidad|ganancia|resultado neto|net income|profit)/, ['utilidad']],
  [/(bpa|por accion|eps)/, ['bpa', 'dividendoPagado']],
  [/(flujo|efectivo|cash)/, ['flujo', 'flujoLibre', 'caja']],
  [/caja/, ['caja', 'flujo']],
  [/(deuda|debt|endeudamiento)/, ['deuda']],
  [/(capex|inversion(es)? de capital)/, ['capex']],
  [/(opex|gasto operativo)/, ['opex']],
  [/dividendo/, ['dividendoPagado']],
  [/(costo|cash cost|aisc)/, ['costos']],
  [/(produccion|onzas|toneladas)/, ['produccion']],
  [/(reservas?|recursos? mineral)/, ['reservas', 'recursos']],
  [/p\/e|price to earnings/, ['pe']],
  [/(crecimiento|variacion|interanual|cuanto (crecio|cayo))/, ['variacion']],
]

export function respuestaMetrica(pregunta) {
  const q = norm(pregunta)
  const claves = new Set()
  for (const [re, cs] of INTENCION_METRICA) {
    if (re.test(q)) cs.forEach((c) => claves.add(c))
  }
  const pedidas = METRICAS.filter((m) => claves.has(m.clave))
  if (!pedidas.length) return null
  const lineas = []
  const usados = []
  for (const m of pedidas) {
    for (const d of docs) {
      const hit = d.metricas.find((x) => x.clave === m.clave)
      if (hit) {
        lineas.push(`💵 ${hit.etiqueta}: ${hit.valorTexto}${hit.esPerdida ? ' (pérdida)' : ''}${d.periodo ? ` — período ${legiblePeriodo(d.periodo)}` : ''}`)
        lineas.push(lineaCita(d, hit))
        usados.push(d)
      }
    }
  }
  // pidió un indicador que NINGÚN documento trae: lo digo explícito (revisé y no está)
  if (!lineas.length) return sinDato(pedidas.map((m) => m.nombre.toLowerCase()).join(' ni '))
  anotarRazonamiento({
    tipo: 'metricas', pregunta,
    docsRevisados: docs.length,
    chunksEvaluados: docs.reduce((s, d) => s + d.chunks.length, 0),
    buscado: pedidas.map((m) => m.nombre),
    usados: [...new Set(usados.map((d) => d.nombre))],
  })
  // 🕵️ verificaciones: contradicciones entre documentos + período preguntado
  const avisos = supervisar({ pregunta, usados, claves: pedidas.map((m) => m.clave) })
  lineas.push(...avisos)
  lineas.push(lineaConfianza({
    fuentes: new Set(usados.map((d) => d.id)).size,
    contradiccion: avisos.some((a) => a.includes('DISTINTAS')),
    periodoMal: avisos.some((a) => a.includes('OTRO período')),
    conOcr: usados.some((d) => d.ocr),
  }))
  return { texto: [`Lo que encontré sobre ${pedidas.map((m) => m.nombre.toLowerCase()).join(' y ')} en tus documentos:`, ...lineas].join('\n') }
}

const legiblePeriodo = (p) => String(p || '').replace('-T', ' · trimestre ')

// comparación entre documentos: misma métrica lado a lado + cambios + contradicciones
export function compararDocumentos() {
  if (docs.length < 2) {
    return { texto: 'Para comparar necesito al menos 2 documentos en la biblioteca 📚 — cárgalos en Sentinel (en cualquier ficha).' }
  }
  const lineas = [`Comparación de tus ${docs.length} documentos, métrica por métrica (solo lo que ellos mismos dicen):`]
  let hallazgos = 0
  for (const m of METRICAS) {
    const entradas = docs
      .map((d) => ({ d, hit: d.metricas.find((x) => x.clave === m.clave) }))
      .filter((x) => x.hit)
    if (entradas.length === 0) continue
    hallazgos++
    lineas.push(`**${m.nombre}**`)
    for (const { d, hit } of entradas) {
      lineas.push(`· ${hit.valorTexto}${hit.esPerdida ? ' (pérdida)' : ''}${d.periodo ? ` (${legiblePeriodo(d.periodo)})` : ''} — 📎 ${cita(d, hit)}`)
    }
    // delta si hay 2 valores numéricos comparables (misma moneda)
    const nums = entradas.filter((x) => x.hit.valorNum != null && monedaDe(x.hit.valorTexto))
    if (nums.length >= 2) {
      const [a, b] = ordenarPorPeriodo(nums)
      if (monedaDe(a.hit.valorTexto) === monedaDe(b.hit.valorTexto) && a.hit.valorNum !== 0) {
        const delta = ((b.hit.valorNum - a.hit.valorNum) / Math.abs(a.hit.valorNum)) * 100
        if (a.d.periodo && b.d.periodo && a.d.periodo === b.d.periodo && Math.abs(delta) > 2) {
          lineas.push(`⚠ OJO: mismo período (${legiblePeriodo(a.d.periodo)}) pero cifras distintas entre documentos — revisa cuál es la fuente correcta.`)
        } else if (Math.abs(delta) >= 15) {
          lineas.push(`📌 Cambio importante: ${delta > 0 ? 'subió' : 'bajó'} ~${Math.abs(delta).toFixed(0)}% entre ambos documentos.`)
        } else {
          lineas.push(`→ Variación entre ambos: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%.`)
        }
      }
    }
  }
  if (!hallazgos) {
    lineas.push('No encontré las métricas clásicas (ingresos, EBITDA, utilidad, flujo, deuda) con montos en estos documentos. Pregúntame algo puntual y busco en el texto.')
  }
  lineas.push('Comparo solo cifras que los documentos declaran textualmente — sin estimar nada.')
  return { texto: lineas.join('\n') }
}

function ordenarPorPeriodo(entradas) {
  return [...entradas].sort((x, y) => String(x.d.periodo || x.d.agregado).localeCompare(String(y.d.periodo || y.d.agregado)))
}

// cronología: fechas + su oración, de todos los documentos, ordenadas
const MES_NUM = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12 }

function fechasDe(texto) {
  const out = []
  for (const m of texto.matchAll(/\b(\d{1,2}) de ([a-záéíóú]+) de (\d{4})\b/gi)) {
    const mes = MES_NUM[norm(m[2])]
    if (mes) out.push({ iso: `${m[3]}-${String(mes).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`, crudo: m[0], i: m.index })
  }
  for (const m of texto.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december) (\d{1,2}),? (\d{4})\b/gi)) {
    out.push({ iso: `${m[3]}-${String(MES_NUM[norm(m[1])]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`, crudo: m[0], i: m.index })
  }
  return out
}

export function cronologiaDocumentos() {
  if (!docs.length) return { texto: SIN_RESPUESTA, sinRespuesta: true }
  const eventos = []
  for (const d of docs) {
    for (const c of d.chunks) {
      for (const f of fechasDe(c.texto)) {
        const oracion = partirOraciones(c.texto).find((o) => o.includes(f.crudo)) || c.texto.slice(Math.max(0, f.i - 60), f.i + 120)
        eventos.push({ iso: f.iso, linea: `📅 ${f.crudo}: «${oracion.slice(0, 170)}${oracion.length > 170 ? '…' : ''}» — 📎 ${cita(d, c)}` })
      }
    }
  }
  if (!eventos.length) return { texto: 'No encontré fechas reconocibles en los documentos para armar una cronología.' }
  const unicos = [...new Map(eventos.map((e) => [e.linea.slice(0, 80), e])).values()]
  unicos.sort((a, b) => a.iso.localeCompare(b.iso))
  return { texto: ['La cronología que sale de tus documentos (cada evento con su fuente):', ...unicos.slice(0, 12).map((e) => e.linea)].join('\n') }
}

// riesgos: oraciones con señales delicadas, citadas
const RE_RIESGO = /(riesgo|contingencia|demanda|litigio|multa|sanci[oó]n|covenant|incumplimiento|p[eé]rdida|deterioro|impairment|lawsuit|litigation|penalt|net loss|default|going concern|negocio en marcha|huelga|paralizaci[oó]n|suspensi[oó]n)/i

export function riesgosDocumentos() {
  if (!docs.length) return { texto: SIN_RESPUESTA, sinRespuesta: true }
  const lineas = []
  for (const d of docs) {
    let porDoc = 0
    for (const c of d.chunks) {
      if (porDoc >= 2) break
      for (const o of partirOraciones(c.texto)) {
        if (o.length >= 50 && o.length <= 400 && RE_RIESGO.test(o)) {
          lineas.push(`⚠ «${o.slice(0, 220)}${o.length > 220 ? '…' : ''}»`)
          lineas.push(`   📎 ${cita(d, c)}`)
          porDoc++
          break
        }
      }
    }
  }
  if (!lineas.length) return { texto: 'No encontré frases de riesgo o contingencia en estos documentos (buena señal, pero léelos igual).' }
  return { texto: ['Los riesgos que tus propios documentos mencionan (textual):', ...lineas.slice(0, 12), 'Esto es un resaltado automático — no reemplaza leer la sección de riesgos completa.'].join('\n') }
}

// el RESUMEN PARA INVERSIONISTAS: qué es cada doc + cifras + cambios + riesgos
export function resumenInversionistas() {
  if (!docs.length) return { texto: SIN_RESPUESTA, sinRespuesta: true }
  const V = { buena: '🟢', mala: '🔴', neutra: '🟡' }
  const lineas = [`**Resumen para inversionistas** de tus ${docs.length} documento${docs.length === 1 ? '' : 's'} (todo extraído de ellos, con fuente):`]
  for (const d of docs) {
    const a = d.analisis || {}
    lineas.push(`📄 **${d.nombre}**${d.periodo ? ` (${legiblePeriodo(d.periodo)})` : ''}: ${a.titulo ? `«${a.titulo}» — ` : ''}${a.categoria || 'documento'} ${V[a.veredicto] || ''}`)
    for (const met of d.metricas.slice(0, esCorto() ? 1 : 3)) {
      lineas.push(`   💵 ${met.etiqueta}: ${met.valorTexto}${met.esPerdida ? ' (pérdida)' : ''} — 📎 ${cita(d, met)}`)
    }
  }
  if (docs.length >= 2) {
    const comp = compararDocumentos().texto.split('\n').filter((l) => l.startsWith('📌') || l.startsWith('⚠'))
    if (comp.length) {
      lineas.push('**Cambios y alertas entre documentos:**')
      lineas.push(...comp.slice(0, 4))
    }
  }
  const r = riesgosDocumentos().texto.split('\n').filter((l) => l.startsWith('⚠ «'))
  if (r.length) {
    lineas.push('**Riesgos que ellos mismos mencionan:**')
    lineas.push(...r.slice(0, 3))
  }
  lineas.push('Nada de esto es recomendación: es lo que TUS documentos dicen, ordenado.')
  return { texto: lineas.join('\n') }
}
