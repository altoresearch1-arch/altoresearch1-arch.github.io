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
      puntuados.push({ doc: x.d, chunk: x.c, puntos })
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
  return top
}

export const SIN_RESPUESTA = 'No encontré esa información en los documentos.'

// ── el ANALISTA: métricas financieras con cita ────────────────────────────

const RE_MONTO = String.raw`(?:(?:S\/\.?|US\$|USD|\$)\s?\(?-?[\d][\d,.]*\)?(?:\s?(?:millones|mill[oó]n|millions?|miles de|miles|mil|billions?|MM|bn))?|[\d][\d,.]*\s?(?:millones|mill[oó]n|millions?|billions?|MM|bn)\b)`

export const METRICAS = [
  { clave: 'ingresos', nombre: 'Ingresos / ventas', re: String.raw`(?:ingresos(?: netos| totales| de actividades ordinarias)?|ventas(?: netas)?|total revenues?|revenues?|net sales)` },
  { clave: 'ebitda', nombre: 'EBITDA', re: String.raw`(?:adjusted ebitda|ebitda(?: ajustado)?)` },
  { clave: 'utilidad', nombre: 'Utilidad neta', re: String.raw`(?:utilidad neta|ganancia neta|resultado neto|p[eé]rdida neta|net (?:income|profit|loss|earnings))` },
  { clave: 'flujo', nombre: 'Flujo de caja', re: String.raw`(?:flujo de (?:caja|efectivo)(?: operativo| libre)?|free cash flow|operating cash flow|cash flow (?:from|used in) operations)` },
  { clave: 'deuda', nombre: 'Deuda', re: String.raw`(?:deuda(?: financiera| neta| total| bruta)?|total debt|net debt|gross debt)` },
]

function extraerMetricas(chunks) {
  const halladas = []
  for (const m of METRICAS) {
    const re = new RegExp(`(${m.re})[^.\\n]{0,80}?(${RE_MONTO})`, 'i')
    for (const c of chunks) {
      const hit = c.texto.match(re)
      if (!hit) continue
      const esPerdida = /p[eé]rdida|net loss/i.test(hit[1])
      halladas.push({
        clave: m.clave, nombre: m.nombre,
        etiqueta: hit[1].trim(), valorTexto: hit[2].trim(),
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

// ── respuestas armadas (todas con cita, todas extractivas) ────────────────

const lineaCita = (doc, chunk) => `   📎 ${cita(doc, chunk)}`

export function respuestaBusqueda(pregunta) {
  const top = buscarEnBiblioteca(pregunta, 3)
  if (!top.length) return { texto: SIN_RESPUESTA, sinRespuesta: true }
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
  return { texto: lineas.join('\n') }
}

export function respuestaMetrica(pregunta) {
  const q = norm(pregunta)
  const pedidas = METRICAS.filter((m) =>
    ({ ingresos: /(ingreso|venta|revenue|sales|facturacion)/, ebitda: /ebitda/,
      utilidad: /(utilidad|ganancia|resultado neto|net income|profit)/,
      flujo: /(flujo|caja|efectivo|cash)/, deuda: /(deuda|debt|endeudamiento)/ })[m.clave].test(q))
  if (!pedidas.length) return null
  const lineas = []
  for (const m of pedidas) {
    for (const d of docs) {
      const hit = d.metricas.find((x) => x.clave === m.clave)
      if (hit) {
        lineas.push(`💵 ${hit.etiqueta}: ${hit.valorTexto}${hit.esPerdida ? ' (pérdida)' : ''}${d.periodo ? ` — período ${legiblePeriodo(d.periodo)}` : ''}`)
        lineas.push(lineaCita(d, hit))
      }
    }
  }
  if (!lineas.length) return { texto: SIN_RESPUESTA, sinRespuesta: true }
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
    for (const met of d.metricas.slice(0, 3)) {
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
