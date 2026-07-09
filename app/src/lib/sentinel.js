import empresasData from '../data/empresas.json'

// ─────────────────────────────────────────────────────────────────────────
// 🛰️ SENTINEL — el lector de hechos de importancia (beta).
//
// El usuario descarga el PDF oficial de la BVL, lo suelta aquí y Sentinel lo
// LEE en su propio navegador (pdf.js; el archivo NUNCA sale de su equipo).
// Qué hace: extrae el texto, detecta empresa y categoría, pesca montos y
// fechas, elige las frases importantes y da un VEREDICTO honesto de si pinta
// a buena, mala o neutra. Luego le pasa todo el contexto a Atlas (#/ia) para
// conversar sobre el documento.
//
// HONESTIDAD (Regla #1): esto es análisis EXTRACTIVO por palabras y patrones
// — organiza y resalta, no "comprende" como un modelo grande. Por eso el
// veredicto dice "pinta a", muestra sus razones y jamás recomienda.
// ─────────────────────────────────────────────────────────────────────────

const CLAVE_CONTEXTO = 'alto-sentinel-contexto'    // sessionStorage: el doc activo para Atlas
const CLAVE_APRENDIDOS = 'alto-sentinel-aprendidos' // localStorage: memoria de docs leídos

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// ── 1) EXTRAER el texto del PDF (pdf.js, import dinámico: solo pesa si se usa)
export async function leerPdf(archivo, onProgreso) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const datos = await archivo.arrayBuffer()
  const tarea = pdfjs.getDocument({ data: datos })
  const doc = await tarea.promise
  let texto = ''
  for (let p = 1; p <= doc.numPages; p++) {
    onProgreso?.(p, doc.numPages)
    const pagina = await doc.getPage(p)
    const contenido = await pagina.getTextContent()
    texto += contenido.items.map((it) => it.str).join(' ') + '\n'
  }
  await tarea.destroy() // en pdf.js v6 el destroy vive en la TAREA, no en el doc
  texto = texto.replace(/[ \t]+/g, ' ').trim()
  if (texto.length < 120) {
    throw new Error('PDF_ESCANEADO') // imagen escaneada sin capa de texto: sin OCR no se puede leer
  }
  return texto
}

// ── 2) ANALIZAR: empresa, categoría, montos, fechas, frases, veredicto

// Orden: de lo MÁS específico a lo más genérico ("resultados" al final, porque
// casi todo comunicado menciona "información financiera" de pasada).
const CATEGORIAS = [
  { clave: 'derivados', re: /(instrumentos financieros derivados|posici[oó]n mensual|hedging|cobertura)/i, prior: 0, rutinario: true, nombre: 'Posición en derivados (reporte mensual rutinario)' },
  { clave: 'dividendo', re: /(dividendo|distribuci[oó]n .{0,20}utilidades|reparto de utilidades|entrega de acciones liberadas)/i, prior: 2, nombre: 'Dividendos / reparto de utilidades' },
  { clave: 'legal', re: /(demanda|arbitraje|sanci[oó]n|multa|proceso judicial|sunat|indecopi|litigio|medida cautelar)/i, prior: -2, nombre: 'Tema legal / regulatorio' },
  { clave: 'operacional', re: /(suspensi[oó]n|paralizaci[oó]n|huelga|accidente|siniestro|interrupci[oó]n|fuerza mayor)/i, prior: -2, nombre: 'Evento operacional' },
  { clave: 'adquisicion', re: /(adquisici[oó]n|compra de|venta de|fusi[oó]n|escisi[oó]n|opa\b|oferta p[uú]blica|toma de control|transferencia de acciones)/i, prior: 1, nombre: 'Compra / venta / reorganización' },
  { clave: 'directorio', re: /(renuncia|designaci[oó]n|nombramiento|remoci[oó]n|nuevo gerente|nuevo director)/i, prior: 0, nombre: 'Cambios en directorio / gerencia' },
  { clave: 'junta', re: /(convocatoria|junta (general|obligatoria|de accionistas)|jga|acuerdos de junta)/i, prior: 0, nombre: 'Junta de accionistas' },
  { clave: 'deuda', re: /(emisi[oó]n de bonos|programa de bonos|financiamiento|pr[eé]stamo|refinanciaci[oó]n|l[ií]nea de cr[eé]dito)/i, prior: 0, nombre: 'Deuda / financiamiento' },
  { clave: 'resultados', re: /(informaci[oó]n financiera|estados financieros|resultados (del|al) |memoria anual|eeff)/i, prior: 0, nombre: 'Resultados / información financiera' },
]

// señales con peso: positivas suman, negativas restan (el veredicto muestra sus razones)
const SENALES = [
  { re: /(aprob[oó].{0,30}dividendo|acord[oó].{0,30}dividendo|pago de dividendo)/i, peso: 3, texto: 'aprueba o paga dividendo' },
  { re: /(utilidad|ganancia).{0,25}(creci[oó]|aument[oó]|super[oó]|r[eé]cord|mayor)/i, peso: 3, texto: 'la ganancia crece' },
  { re: /(r[eé]cord|hist[oó]ric[oa] m[aá]xim)/i, peso: 2, texto: 'menciona cifras récord' },
  { re: /(nuevo contrato|adjudicaci[oó]n|buena pro|expansi[oó]n|ampliaci[oó]n|inicio de (producci[oó]n|operaciones))/i, peso: 2, texto: 'crecimiento u operación nueva' },
  { re: /(reducci[oó]n de deuda|prepago|recompra de acciones)/i, peso: 2, texto: 'reduce deuda o recompra acciones' },
  { re: /(p[eé]rdida|resultado negativo)/i, peso: -3, texto: 'menciona pérdidas' },
  { re: /(utilidad|ganancia|ingresos?|ventas?).{0,25}(cay[oó]|disminuy[oó]|se redujo|menor)/i, peso: -3, texto: 'la ganancia o ventas caen' },
  { re: /(sanci[oó]n|multa|demanda|arbitraje|litigio|medida cautelar)/i, peso: -3, texto: 'problema legal o sanción' },
  { re: /(suspensi[oó]n|paralizaci[oó]n|huelga|interrupci[oó]n|fuerza mayor|siniestro|accidente)/i, peso: -3, texto: 'operación afectada' },
  { re: /(renuncia)/i, peso: -1, texto: 'renuncia en la plana directiva' },
  // OJO: "liquidación" a secas NO — en derivados significa settlement del contrato
  { re: /(incumplimiento|insolvencia|quiebra|(?:en|proceso de)\s+liquidaci[oó]n)/i, peso: -4, texto: 'problema financiero serio' },
  { re: /(no .{0,20}repartir[aá]?|sin dividendos)/i, peso: -1, texto: 'no habrá reparto' },
]

const sinCola = (n) => n.replace(/\s+(S\.?A\.?A?\.?|S\.?A\.?C\.?)\s*$/i, '').trim()

// Preguntas sugeridas SEGÚN el tipo de documento (estilo NotebookLM, pero las
// respuestas salen de nuestro glosario y del propio texto — cero invención).
export const PREGUNTAS_POR_CATEGORIA = {
  derivados: ['¿Qué es un Zero Cost Collar?', '¿Cuánto lleva ganado o perdido con derivados?', '¿Qué es el monto nocional?'],
  dividendo: ['¿Cuánto paga por acción?', '¿Qué es la fecha de registro?', '¿Qué es el yield?'],
  resultados: ['¿Qué montos menciona el documento?', '¿Qué es el margen neto?', '¿Qué es el BPA?'],
  junta: ['¿Qué se va a decidir en la junta?', '¿Qué es una junta de accionistas?'],
  adquisicion: ['¿Qué es una OPA?', '¿Quién compra y quién vende?', '¿Qué es un holding?'],
  directorio: ['¿Quién entra o sale de la empresa?', '¿Qué es el directorio?'],
  legal: ['¿Qué es un arbitraje?', '¿De cuánto es la multa o demanda?'],
  operacional: ['¿Qué operación se afectó?', '¿Desde cuándo y hasta cuándo?'],
  deuda: ['¿Cuánta deuda se emite o refinancia?', '¿Qué es la deuda neta?'],
}

// Extractores ESPECIALIZADOS por tipo de documento: pescan los datos que un
// lector experto buscaría (instrumento, onzas cubiertas, resultado acumulado,
// dividendo por acción, fechas de registro/pago…).
function extraerDetalles(texto, clave) {
  const det = {}
  if (clave === 'derivados') {
    // en orden de ESPECIFICIDAD (match() devuelve lo primero del texto, no del patrón)
    const inst = /zero\s*cost\s*collar|collar/i.test(texto) ? 'Zero Cost Collar (banda de precios sin costo inicial)'
      : /forward/i.test(texto) ? 'forwards (precio pactado a futuro)'
      : /swap/i.test(texto) ? 'swaps'
      : /opcion(?:es)?/i.test(texto) ? 'opciones' : null
    if (inst) det.instrumento = inst
    const nocionales = [...texto.matchAll(/([\d][\d,]*(?:\.\d+)?)\s*(onzas|oz|toneladas|tm\b|tmf)\s*(?:de\s*)?(plata|oro|zinc|cobre|plomo|estano|estaño)?/gi)]
      .slice(0, 4).map((m) => `${m[1]} ${m[2]}${m[3] ? ' de ' + m[3] : ''}`)
    if (nocionales.length) det.nocional = nocionales
    const acum = texto.match(/(?:acumulad[oa]s?|del\s+ano|del\s+año|anual(?:izado)?)[^.]{0,80}?((?:US\$|\$|S\/)\s?[\d][\d,]*(?:\.\d+)?)/i)
      || texto.match(/((?:US\$|\$|S\/)\s?[\d][\d,]*(?:\.\d+)?)[^.]{0,60}(?:acumulad[oa]s?)/i)
    if (acum) det.resultadoAcumulado = acum[1]
  }
  if (clave === 'dividendo') {
    const porAccion = texto.match(/((?:US\$|\$|S\/\.?)\s?[\d]+(?:\.\d+)?)[^.]{0,40}por\s+acci[oó]n/i)
    if (porAccion) det.porAccion = porAccion[1]
    const registro = texto.match(/fecha\s+de\s+registro[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))/i)
    if (registro) det.fechaRegistro = registro[1]
    const entrega = texto.match(/fecha\s+de\s+(?:entrega|pago)[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))/i)
    if (entrega) det.fechaEntrega = entrega[1]
  }
  return det
}

function detectarEmpresa(textoN) {
  let mejor = null
  for (const e of empresasData.empresas) {
    const alias = norm(sinCola(e.nombre))
    let puntos = 0
    if (alias.length >= 5 && textoN.includes(alias)) puntos += 3
    if (textoN.includes(norm(e.ticker))) puntos += 2
    // palabra fuerte del nombre (ej. "buenaventura", "backus")
    const fuertes = alias.split(' ').filter((w) => w.length >= 6)
    for (const w of fuertes) if (textoN.includes(w)) puntos += 1
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { e, puntos }
  }
  return mejor && mejor.puntos >= 2 ? mejor.e : null
}

export function analizar(texto, nombreArchivo = '') {
  const textoN = norm(texto)
  const empresa = detectarEmpresa(textoN)

  let categoria = null
  for (const c of CATEGORIAS) {
    if (c.re.test(texto) || c.re.test(nombreArchivo)) { categoria = c; break }
  }

  // montos: S/ 1,234.5 millones · US$ 0.3413 · 5.5% ...
  const montos = [...new Set(
    (texto.match(/(?:S\/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|mil|MM|M)\b)?|[\d]+(?:\.\d+)?\s?%/g) || [])
      .map((m) => m.trim()).filter((m) => m.length >= 3)
  )].slice(0, 8)

  const fechas = [...new Set(
    (texto.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [a-záéíóu]+ de \d{4}\b|\b\d{4}-\d{2}-\d{2}\b/gi) || [])
  )].slice(0, 6)

  // veredicto: señales con peso + el "prior" de la categoría
  let puntaje = categoria?.prior || 0
  const razones = []
  if (categoria?.prior >= 2) razones.push(`categoría favorable (${categoria.nombre.toLowerCase()})`)
  if (categoria?.prior <= -2) razones.push(`categoría delicada (${categoria.nombre.toLowerCase()})`)
  for (const s of SENALES) {
    if (s.re.test(texto)) {
      puntaje += s.peso
      razones.push((s.peso > 0 ? '🟢 ' : '🔴 ') + s.texto)
    }
  }
  let veredicto = puntaje >= 2 ? 'buena' : puntaje <= -2 ? 'mala' : 'neutra'
  // Los reportes RUTINARIOS (ej. posición mensual en derivados) mencionan
  // "pérdidas/ganancias/liquidación" como parte de sus TABLAS — eso no es
  // noticia. SIEMPRE neutra (falso 🔴 de Minsur cazado el 09-jul).
  if (categoria?.rutinario) {
    veredicto = 'neutra'
    razones.length = 0
    razones.push('es un reporte periódico rutinario (informativo, no una noticia)')
  }

  // frases clave: oraciones con montos / señales / palabras de la categoría
  const oraciones = texto.split(/(?<=[.;])\s+|\n+/).map((o) => o.trim())
    .filter((o) => o.length >= 40 && o.length <= 320)
  const puntuadas = oraciones.map((o) => {
    let p = 0
    if (/(?:S\/|US\$|USD|\$)\s?\d|%/.test(o)) p += 2
    for (const s of SENALES) if (s.re.test(o)) p += 2
    if (categoria && categoria.re.test(o)) p += 1
    if (/(acuerd|aprob|inform|comunic)/i.test(o)) p += 1
    return { o, p }
  }).filter((x) => x.p >= 2).sort((a, b) => b.p - a.p)
  const frases = puntuadas.slice(0, 5).map((x) => x.o)

  return {
    empresa: empresa ? sinCola(empresa.nombre) : null,
    ticker: empresa?.ticker || null,
    categoria: categoria?.nombre || 'Sin categoría clara',
    veredicto,
    puntaje,
    razones: razones.slice(0, 5),
    montos,
    fechas,
    frases,
    detalles: extraerDetalles(texto, categoria?.clave),
    preguntas: PREGUNTAS_POR_CATEGORIA[categoria?.clave] || null,
    // el texto entero (recortado) viaja a Atlas para responder repreguntas
    texto: texto.slice(0, 15000),
    nombreArchivo,
    paginasLeidas: null, // lo llena el componente
  }
}

// ── 3) PASARLE el contexto a Atlas (sessionStorage) + memoria de aprendidos

export function guardarContexto(informe) {
  try {
    sessionStorage.setItem(CLAVE_CONTEXTO, JSON.stringify({ ...informe, nuevo: true }))
  } catch { /* sin storage */ }
}

export function leerContexto() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_CONTEXTO))
  } catch { return null }
}

export function marcarContextoVisto() {
  try {
    const c = leerContexto()
    if (c?.nuevo) { c.nuevo = false; sessionStorage.setItem(CLAVE_CONTEXTO, JSON.stringify(c)) }
  } catch { /* nada */ }
}

// Atlas "aprende" cada hecho leído: memoria liviana en ESTE navegador
// (fecha de lectura la ponemos legible; sin texto completo para no llenar el storage)
export function recordarHecho(informe) {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_APRENDIDOS)) || []
    lista.push({
      cuando: new Date().toISOString().slice(0, 10),
      empresa: informe.empresa,
      ticker: informe.ticker,
      categoria: informe.categoria,
      veredicto: informe.veredicto,
      frase: informe.frases[0] || null,
    })
    localStorage.setItem(CLAVE_APRENDIDOS, JSON.stringify(lista.slice(-15)))
  } catch { /* sin storage */ }
}

export function hechosAprendidos() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_APRENDIDOS)) || []
  } catch { return [] }
}
