import empresasData from '../data/empresas.json'

// ─────────────────────────────────────────────────────────────────────────
// 🛰️ SENTINEL — el lector de hechos de importancia (beta).
//
// El usuario descarga el PDF oficial de la BVL (o le toma FOTO al documento),
// lo suelta aquí y Sentinel lo LEE en su propio navegador (pdf.js; y si es
// imagen o escaneado, OCR con tesseract.js — el archivo NUNCA sale de su
// equipo, solo se descarga el motor de OCR de un CDN público la primera vez).
// Qué hace: extrae el texto, detecta empresa y categoría (en ESPAÑOL y en
// INGLÉS — las matrices extranjeras comunican en inglés), pesca montos,
// fechas y datos finos (quién negocia con quién, dividendo por acción…),
// elige las frases importantes y da un VEREDICTO honesto. Luego le pasa todo
// el contexto a Atlas (#/ia) para conversar sobre el documento.
//
// HONESTIDAD (Regla #1): esto es análisis EXTRACTIVO por palabras y patrones
// — organiza y resalta, no "comprende" como un modelo grande. Por eso el
// veredicto dice "pinta a", muestra sus razones y jamás recomienda.
//
// ⚠ ESPEJO: las reglas de análisis (CATEGORIAS/SENALES/extractores/frases)
// están portadas a Python en extractor/gen_lecturas.py — si cambias algo
// aquí, cámbialo allá (y sube VERSION_ANALISIS para que el robot re-lea).
// ─────────────────────────────────────────────────────────────────────────

const CLAVE_CONTEXTO = 'alto-sentinel-contexto'    // sessionStorage: el doc activo para Atlas
const CLAVE_APRENDIDOS = 'alto-sentinel-aprendidos' // localStorage: memoria de docs leídos

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ') // los saltos de línea del PDF/OCR no deben romper "minera poderosa"

const limpiar = (t) => t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

// ── 1) LEER el documento: PDF con texto (pdf.js) · PDF escaneado o FOTO (OCR)

// tesseract.js entero por CDN (nada entra al bundle ni al precache de la PWA;
// worker, wasm y los idiomas spa+eng también vienen de jsdelivr por defecto)
const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js'
const MAX_PAGINAS_OCR = 8 // tope sano: un HI escaneado rara vez pasa de esto

async function crearLectorOcr(onEstado) {
  let mod
  try {
    mod = await import(/* @vite-ignore */ TESSERACT_CDN)
  } catch {
    throw new Error('OCR_SIN_INTERNET') // el motor viene de un CDN: sin red no hay OCR
  }
  const createWorker = mod.createWorker || mod.default?.createWorker
  onEstado?.('preparando el motor de OCR (se descarga solo la primera vez)…')
  return createWorker(['spa', 'eng'], 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onEstado?.(`descifrando la imagen… ${Math.round((m.progress || 0) * 100)}%`)
      }
    },
  })
}

// Una FOTO del documento (jpg/png/webp): OCR directo sobre la imagen
export async function leerImagen(archivo, onEstado) {
  const worker = await crearLectorOcr(onEstado)
  try {
    const { data } = await worker.recognize(archivo)
    const texto = limpiar(data.text || '')
    if (texto.length < 60) throw new Error('OCR_ILEGIBLE')
    return { texto, paginas: 1, ocr: true, porPagina: [{ n: 1, texto }] }
  } finally {
    await worker.terminate()
  }
}

export async function leerPdf(archivo, onEstado) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const datos = await archivo.arrayBuffer()
  const tarea = pdfjs.getDocument({ data: datos })
  const doc = await tarea.promise
  try {
    let texto = ''
    const porPagina = [] // texto por página: la Biblioteca cita "Doc.pdf · Página N"
    for (let p = 1; p <= doc.numPages; p++) {
      onEstado?.(`leyendo página ${p} de ${doc.numPages}…`)
      const pagina = await doc.getPage(p)
      const contenido = await pagina.getTextContent()
      // hasEOL conserva los saltos de línea reales (con eso se pesca el TÍTULO)
      const textoPag = limpiar(
        contenido.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('')
      ).replace(/(\d)\s*,\s*(?=\d)/g, '$1,')
      porPagina.push({ n: p, texto: textoPag })
      texto += textoPag + '\n'
    }
    // números que el PDF parte con espacios o saltos ("623 , 015 Onzas") se re-pegan
    texto = limpiar(texto).replace(/(\d)\s*,\s*(?=\d)/g, '$1,')
    if (texto.length >= 120) {
      return { texto, paginas: doc.numPages, ocr: false, porPagina }
    }

    // PDF escaneado (imagen sin capa de texto): se dibuja cada página en un
    // canvas y el OCR la descifra — antes esto era un error, ahora se lee 📷
    const worker = await crearLectorOcr(onEstado)
    try {
      let textoOcr = ''
      const porPaginaOcr = []
      const total = Math.min(doc.numPages, MAX_PAGINAS_OCR)
      for (let p = 1; p <= total; p++) {
        onEstado?.(`página ${p} de ${total} — pasándola por OCR…`)
        const pagina = await doc.getPage(p)
        const escala = Math.min(2.2, 2000 / pagina.getViewport({ scale: 1 }).width)
        const viewport = pagina.getViewport({ scale: escala })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await pagina.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise
        const { data } = await worker.recognize(canvas)
        const textoPag = limpiar(data.text || '')
        porPaginaOcr.push({ n: p, texto: textoPag })
        textoOcr += textoPag + '\n'
      }
      textoOcr = limpiar(textoOcr)
      if (textoOcr.length < 60) throw new Error('OCR_ILEGIBLE')
      return { texto: textoOcr, paginas: doc.numPages, ocr: true, porPagina: porPaginaOcr }
    } finally {
      await worker.terminate()
    }
  } finally {
    await tarea.destroy() // en pdf.js v6 el destroy vive en la TAREA, no en el doc
  }
}

// La puerta única que usa el componente: decide sola si es PDF o foto
export async function leerDocumento(archivo, onEstado) {
  const esImagen = /^image\//.test(archivo.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(archivo.name)
  return esImagen ? leerImagen(archivo, onEstado) : leerPdf(archivo, onEstado)
}

// ── 2) ANALIZAR: empresa, categoría, montos, fechas, frases, veredicto
//     (bilingüe: los comunicados de matrices extranjeras vienen en inglés)

// Orden: de lo MÁS específico a lo más genérico ("resultados" al final, porque
// casi todo comunicado menciona "información financiera" de pasada).
const CATEGORIAS = [
  { clave: 'derivados', re: /(instrumentos financieros derivados|posici[oó]n mensual|hedging|cobertura)/i, prior: 0, rutinario: true, nombre: 'Posición en derivados (reporte mensual rutinario)' },
  { clave: 'dividendo', re: /(dividendo|dividend\b|distribuci[oó]n .{0,20}utilidades|reparto de utilidades|entrega de acciones liberadas)/i, prior: 2, nombre: 'Dividendos / reparto de utilidades' },
  { clave: 'legal', re: /(demanda|arbitraje|sanci[oó]n|multa|proceso judicial|sunat|indecopi|litigio|medida cautelar|lawsuit|arbitration|litigation|court ruling|\bfined\b|penalt(?:y|ies))/i, prior: -2, nombre: 'Tema legal / regulatorio' },
  { clave: 'operacional', re: /(suspensi[oó]n|paralizaci[oó]n|huelga|accidente|siniestro|interrupci[oó]n|fuerza mayor|shutdown|stoppage|force majeure|work stoppage)/i, prior: -2, nombre: 'Evento operacional' },
  { clave: 'adquisicion', re: /(adquisici[oó]n|compra de|venta de|fusi[oó]n|escisi[oó]n|opa\b|oferta p[uú]blica|toma de control|transferencia de acciones|negociaciones|acquisition|merger|takeover|tender offer|potential transaction|negotiations?\b|change of control|divestiture|spin-?off|sale of (?:a |its )?(?:stake|interest|shares))/i, prior: 1, nombre: 'Compra / venta / reorganización' },
  { clave: 'directorio', re: /(renuncia|designaci[oó]n|nombramiento|remoci[oó]n|nuevo gerente|nuevo director|resignation|appointment of|appointed|new (?:ceo|cfo|chairman))/i, prior: 0, nombre: 'Cambios en directorio / gerencia' },
  { clave: 'junta', re: /(convocatoria|junta (general|obligatoria|de accionistas)|jga|acuerdos de junta|shareholders'? meeting|annual general meeting|\bagm\b)/i, prior: 0, nombre: 'Junta de accionistas' },
  { clave: 'deuda', re: /(emisi[oó]n de bonos|programa de bonos|financiamiento|pr[eé]stamo|refinanciaci[oó]n|l[ií]nea de cr[eé]dito|senior notes|notes offering|bond issuance|credit facility|loan agreement|refinanc)/i, prior: 0, nombre: 'Deuda / financiamiento' },
  { clave: 'rating', re: /(clasificaci[oó]n de riesgo|clasificadora de riesgo|credit rating|rating action|moody'?s|fitch ratings|s&p global)/i, prior: 0, nombre: 'Informe de clasificación de riesgo' },
  { clave: 'auditoria', re: /(trabajos de auditor[ií]a|sociedad de auditor[ií]a|auditor(?:es)? externos?|auditor[ií]a externa|external auditors?)/i, prior: 0, nombre: 'Auditoría externa' },
  { clave: 'resultados', re: /(informaci[oó]n financiera|estados financieros|resultados (del|al) |memoria anual|eeff|financial statements|quarterly (?:results|report)|earnings (?:release|report)|annual report)/i, prior: 0, nombre: 'Resultados / información financiera' },
]

// señales con peso: positivas suman, negativas restan (el veredicto muestra sus razones)
const SENALES = [
  { re: /(aprob[oó].{0,30}dividendo|acord[oó].{0,30}dividendo|pago de dividendo|declared? .{0,30}dividend|approved? .{0,30}dividend|dividend payment)/i, peso: 3, texto: 'aprueba o paga dividendo' },
  { re: /(utilidad|ganancia|net income|profit|revenue|earnings).{0,30}(creci[oó]|aument[oó]|super[oó]|r[eé]cord|mayor|increased|grew|rose|record|higher)/i, peso: 3, texto: 'la ganancia crece' },
  { re: /(r[eé]cord|hist[oó]ric[oa] m[aá]xim|all-?time high|record (?:production|revenue|earnings|results))/i, peso: 2, texto: 'menciona cifras récord' },
  { re: /(nuevo contrato|adjudicaci[oó]n|buena pro|expansi[oó]n|ampliaci[oó]n|inicio de (producci[oó]n|operaciones)|new contract|contract award|expansion project|started? (?:production|operations)|ramp-?up)/i, peso: 2, texto: 'crecimiento u operación nueva' },
  { re: /(reducci[oó]n de deuda|prepago|recompra de acciones|debt (?:reduction|repayment)|share (?:buyback|repurchase))/i, peso: 2, texto: 'reduce deuda o recompra acciones' },
  { re: /(p[eé]rdida|resultado negativo|net loss|impairment|write-?(?:off|down))/i, peso: -3, texto: 'menciona pérdidas' },
  { re: /(utilidad|ganancia|ingresos?|ventas?|net income|profit|revenue|earnings|production).{0,30}(cay[oó]|disminuy[oó]|se redujo|menor|fell|declined|decreased|dropped|lower)/i, peso: -3, texto: 'la ganancia o ventas caen' },
  { re: /(sanci[oó]n|multa|demanda|arbitraje|litigio|medida cautelar|lawsuit|litigation|penalt(?:y|ies)|\bfined\b)/i, peso: -3, texto: 'problema legal o sanción' },
  { re: /(suspensi[oó]n|paralizaci[oó]n|huelga|interrupci[oó]n|fuerza mayor|siniestro|accidente|shutdown|stoppage|force majeure)/i, peso: -3, texto: 'operación afectada' },
  { re: /(renuncia|resignation)/i, peso: -1, texto: 'renuncia en la plana directiva' },
  // OJO: "liquidación" a secas NO — en derivados significa settlement del contrato
  { re: /(incumplimiento|insolvencia|quiebra|(?:en|proceso de)\s+liquidaci[oó]n|default\b|insolvency|bankruptcy)/i, peso: -4, texto: 'problema financiero serio' },
  { re: /(no .{0,20}repartir[aá]?|sin dividendos|no dividend)/i, peso: -1, texto: 'no habrá reparto' },
]

const sinCola = (n) => n.replace(/\s+(S\.?A\.?A?\.?|S\.?A\.?C\.?)\s*$/i, '').trim()

// Preguntas sugeridas SEGÚN el tipo de documento (estilo NotebookLM, pero las
// respuestas salen de nuestro glosario y del propio texto — cero invención).
export const PREGUNTAS_POR_CATEGORIA = {
  derivados: ['¿Qué es un Zero Cost Collar?', '¿Cuánto lleva ganado o perdido con derivados?', '¿Qué es el monto nocional?'],
  dividendo: ['¿Cuánto paga por acción?', '¿Qué es la fecha de registro?', '¿Qué es el yield?'],
  resultados: ['¿Qué montos menciona el documento?', '¿Qué es el margen neto?', '¿Qué es el BPA?'],
  junta: ['¿Qué se va a decidir en la junta?', '¿Qué es una junta de accionistas?'],
  adquisicion: ['¿Quién compra y quién vende?', '¿Qué es una OPA?', '¿Qué es un holding?'],
  directorio: ['¿Quién entra o sale de la empresa?', '¿Qué es el directorio?'],
  legal: ['¿Qué es un arbitraje?', '¿De cuánto es la multa o demanda?'],
  operacional: ['¿Qué operación se afectó?', '¿Desde cuándo y hasta cuándo?'],
  deuda: ['¿Cuánta deuda se emite o refinancia?', '¿Qué es la deuda neta?'],
  rating: ['¿Qué es una clasificación de riesgo?', '¿Qué montos menciona el documento?'],
  auditoria: ['¿Qué es una auditoría externa?', '¿Qué es la SMV?'],
}

// Los comunicados en inglés SIEMPRE pegan al final páginas de legalese
// ("forward-looking statements") llenas de palabras alarmantes (strikes,
// litigation, losses…) que NO son noticia: se recortan antes de analizar.
function textoUtilDe(texto) {
  const corte = texto.search(/cautionary statement|forward-?looking statements|safe harbor/i)
  return corte > 200 ? texto.slice(0, corte) : texto
}

// ¿Español o inglés? (conteo simple de palabras función en el arranque)
function detectarIdioma(texto) {
  const t = ' ' + norm(texto).slice(0, 4000).replace(/\n/g, ' ') + ' '
  const en = (t.match(/ (the|and|of|to|with|for|that|this) /g) || []).length
  const es = (t.match(/ (el|la|los|las|de|del|que|con|para|una) /g) || []).length
  return en > es * 1.5 ? 'en' : 'es'
}

// El TÍTULO del comunicado (los HI suelen ponerlo EN MAYÚSCULAS al arranque)
function extraerTitulo(texto) {
  const lineas = texto.slice(0, 1200).split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
  for (const l of lineas) {
    if (l.length < 18 || l.length > 150) continue
    if (/hecho de importancia|se[ñn]ores|superintendencia|smv\b|bolsa de valores|av\.|jr\.|calle |^ref\.?[.:]|^asunto|de nuestra consideraci[oó]n|^lima,|^luxembourg|^luxemburgo|registro p[uú]blico/i.test(l)) continue
    const letras = l.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '')
    if (letras.length < 12) continue
    const mayus = letras.replace(/[a-záéíóúñ]/g, '').length / letras.length
    if (mayus >= 0.7) return l
  }
  return null
}

// frases que son puro formalismo o legalese: jamás valen como "frase clave"
const BOILERPLATE = /(forward-?looking|cautionary|undertakes no obligation|de nuestra consideraci[oó]n|atentamente|further information|investor relations|www\.|@|s[ií]rvase|muy se[ñn]or|neither (?:the )?tsx venture exchange)/i

// el punto de "S.A." / "Inc." NO cierra la oración (partía "Nexa Resources S.A." a la mitad)
const ABREV_FINAL = /\b(?:S\.A\.A|S\.A\.C|S\.A|U\.S|Inc|Ltd|Corp|C[ií]a|No|Nro|Sr|Sra|Srta|Dr|Dra|Mr|Ms)\.$/

// Trocea en oraciones sin caer en la trampa de las abreviaturas (Atlas también la usa)
export function partirOraciones(cuerpo) {
  const oraciones = []
  let actual = ''
  for (let frag of cuerpo.split(/(?<=[.;])\s+/)) {
    frag = frag.trim().replace(/^\d{1,3}\s+/, '') // número de página colado
    actual = actual ? (actual + ' ' + frag).trim() : frag
    if (ABREV_FINAL.test(actual)) continue // terminó en abreviatura: la oración sigue
    if (actual) oraciones.push(actual)
    actual = ''
  }
  if (actual) oraciones.push(actual)
  return oraciones
}

// Extractores ESPECIALIZADOS por tipo de documento: pescan los datos que un
// lector experto buscaría (instrumento, onzas cubiertas, resultado acumulado,
// dividendo por acción, quién negocia con quién, montos de multa/deuda…).
function extraerDetalles(texto, clave) {
  const det = {}
  if (clave === 'derivados') {
    // en orden de ESPECIFICIDAD (match() devuelve lo primero del texto, no del patrón)
    const inst = /zero\s*cost\s*collar|collar/i.test(texto) ? 'Zero Cost Collar (banda de precios sin costo inicial)'
      : /forward/i.test(texto) ? 'forwards (precio pactado a futuro)'
      : /swap/i.test(texto) ? 'swaps'
      : /opcion(?:es)?/i.test(texto) ? 'opciones' : null
    if (inst) det.instrumento = inst
    // el metal puede venir ANTES (tabla: "Plata … 623,015 Onzas") o después
    const conMetal = [...texto.matchAll(/(plata|oro|zinc|cobre|plomo|esta[ñn]o)[^\d\n]{0,50}([\d][\d,]*(?:\.\d+)?)\s*(onzas|oz|toneladas|tm\b|tmf)/gi)]
      .map((m) => `${m[2]} ${m[3]} de ${m[1].toLowerCase()}`)
    const sinMetal = [...texto.matchAll(/([\d][\d,]*(?:\.\d+)?)\s*(onzas|oz|toneladas|tm\b|tmf)\s*(?:de\s*)?(plata|oro|zinc|cobre|plomo|estano|estaño)?/gi)]
      .map((m) => `${m[1]} ${m[2]}${m[3] ? ' de ' + m[3] : ''}`)
    const nocionales = (conMetal.length ? conMetal : sinMetal).slice(0, 4)
    if (nocionales.length) det.nocional = nocionales
    const acum = texto.match(/(?:acumulad[oa]s?|del\s+ano|del\s+año|anual(?:izado)?)[^.]{0,80}?((?:US\$|\$|S\/)\s?[\d][\d,]*(?:\.\d+)?)/i)
      || texto.match(/((?:US\$|\$|S\/)\s?[\d][\d,]*(?:\.\d+)?)[^.]{0,60}(?:acumulad[oa]s?)/i)
    if (acum) det.resultadoAcumulado = acum[1]
  }
  if (clave === 'dividendo') {
    // el número COMPLETO (con comas) y PEGADO a "por acción" — antes "S/.20,000,000
    // … por acción" (el total) se truncaba a "S/.20" y salía como dividendo (bug real)
    const porAccion = texto.match(/((?:US\$|\$|S\/\.?)\s?[\d][\d,]*(?:\.\d+)?)\s*(?:brutos?|netos?|nominales?)?\s*(?:por\s+acci[oó]n|per\s+share)/i)
    if (porAccion) det.porAccion = porAccion[1]
    const registro = texto.match(/fecha\s+de\s+registro[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))/i)
    if (registro) det.fechaRegistro = registro[1]
    const entrega = texto.match(/fecha\s+de\s+(?:entrega|pago)[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))/i)
    if (entrega) det.fechaEntrega = entrega[1]
  }
  if (clave === 'adquisicion') {
    // ¿entre quiénes es el trato? "negotiations between X and Y" / "entre X y Y"
    const partes = texto.match(/(?:between|entre)\s+([A-ZÁÉÍÓÚ][\w.&\s-]{1,45}?)\s*(?:\([^)]{1,25}\))?\s*(?:and|y)\s+([A-ZÁÉÍÓÚ][\w.&\s-]{1,45}?)(?=\s+(?:regarding|respecto|sobre|para|relativ|to\b|in\b|on\b)|[.,;])/)
    if (partes) det.partes = `${partes[1].trim()} y ${partes[2].trim()}`
    if (/no certainty|no assurances?|en negociaci[oó]n|conversaciones en curso|ongoing negotiations|potential transaction|sin (?:que exista )?acuerdo/i.test(texto)) {
      det.enNegociacion = true
    }
    if (/change of control|toma de control|controlling (?:stake|interest)|participaci[oó]n de control|interest in the company/i.test(texto)) {
      det.cambioControl = true
    }
    const montoOp = texto.match(/((?:US\$|USD|\$|S\/\.?)\s?[\d][\d,.]*\s?(?:millones|mill[oó]n|million|billion|MM|bn)\b)/i)
    if (montoOp) det.montoOperacion = montoOp[1]
  }
  if (clave === 'legal') {
    const multa = texto.match(/(?:multa|sanci[oó]n|penalt(?:y|ies)|fined?|demanda|pretensi[oó]n)[^.]{0,60}?((?:S\/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|million|MM)\b)?|[\d][\d,.]*\s?UIT)/i)
    if (multa) det.montoLegal = multa[1]
  }
  if (clave === 'deuda') {
    const monto = texto.match(/((?:S\/\.?|US\$|USD|\$)\s?[\d][\d,.]*\s?(?:millones|mill[oó]n|million|billion|MM|bn)?\b)[^.]{0,60}?(?:bonos|notes|emisi[oó]n|pr[eé]stamo|loan|credit|financiamiento)/i)
      || texto.match(/(?:bonos|notes|emisi[oó]n|pr[eé]stamo|loan|financiamiento)[^.]{0,60}?((?:S\/\.?|US\$|USD|\$)\s?[\d][\d,.]*\s?(?:millones|mill[oó]n|million|billion|MM|bn)?\b)/i)
    if (monto) det.montoDeuda = monto[1]
    const tasa = texto.match(/(\d+(?:\.\d+)?\s?%)\s?(?:anual|de inter[eé]s|per annum|interest)/i)
    if (tasa) det.tasa = tasa[1]
  }
  if (clave === 'directorio') {
    const persona = texto.match(/(?:renuncia|designaci[oó]n|nombramiento|remoci[oó]n|resignation|appointment)[^.]{0,60}?(?:se[ñn]ora?|sr\.?|sra\.?|don|do[ñn]a|mr\.?|ms\.?)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+){1,3})/)
    if (persona) det.persona = persona[1]
    const cargo = texto.match(/(gerente general|presidente del directorio|director(?:a)? (?:titular|suplente|independiente)|gerente de [a-záéíóúñ]+|chief executive officer|chief financial officer|\bceo\b|\bcfo\b)/i)
    if (cargo) det.cargo = cargo[1]
  }
  if (clave === 'resultados') {
    const utilidad = texto.match(/(?:utilidad neta|ganancia neta|net income|net profit)[^.]{0,60}?((?:S\/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|million|MM)\b)?)/i)
    if (utilidad) det.utilidad = utilidad[1]
    const ingresos = texto.match(/(?:ingresos|ventas netas|revenues?|net sales)[^.]{0,60}?((?:S\/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|million|MM)\b)?)/i)
    if (ingresos) det.ingresos = ingresos[1]
  }
  return det
}

// palabras genéricas que NO identifican a una empresa (espejo de cerebro.js)
const GENERICAS = new Set(['compania', 'corporacion', 'sociedad', 'minera', 'minas', 'banco',
  'grupo', 'empresa', 'peruana', 'peruano', 'peru', 'lima', 'corp', 'holding', 'inversiones',
  'industrias', 'consorcio', 'financiera', 'seguros', 'andina', 'general', 'nacional', 'agraria',
  'agroindustrial', 'azucarera', 'electrica', 'electricidad', 'energia', 'internacional', 'resources'])

function detectarEmpresa(textoN, tickerPista) {
  let candidatos = []
  for (const e of empresasData.empresas) {
    const alias = norm(sinCola(e.nombre))
    let puntos = 0
    if (alias.length >= 5 && textoN.includes(alias)) puntos += 3
    if (textoN.includes(norm(e.ticker))) puntos += 2
    // palabras distintivas del nombre (≥4 letras y no genéricas: "nexa", "backus")
    const fuertes = alias.split(' ').filter((w) => w.length >= 4 && !GENERICAS.has(w))
    for (const w of fuertes) if (textoN.includes(w)) puntos += 1
    if (puntos > 0) candidatos.push({ e, puntos })
  }
  candidatos.sort((a, b) => b.puntos - a.puntos)
  const tope = candidatos[0]?.puntos || 0
  if (tope >= 2) {
    // desempate: si la ficha donde está el usuario empata en puntos, es esa
    const empatados = candidatos.filter((c) => c.puntos === tope)
    const dePista = empatados.find((c) => c.e.ticker === tickerPista)
    return (dePista || empatados[0]).e
  }
  // sin detección clara: el usuario lo soltó EN la ficha de una empresa — usarla
  if (tickerPista) {
    const e = empresasData.empresas.find((x) => x.ticker === tickerPista)
    if (e) return e
  }
  return null
}

export function analizar(texto, nombreArchivo = '', tickerPista = null) {
  const textoN = norm(texto)
  const empresa = detectarEmpresa(textoN, tickerPista)
  const textoUtil = textoUtilDe(texto) // sin el legalese del final
  const idioma = detectarIdioma(texto)
  const titulo = extraerTitulo(texto)

  let categoria = null
  for (const c of CATEGORIAS) {
    if (c.re.test(textoUtil) || c.re.test(nombreArchivo)) { categoria = c; break }
  }

  // montos: S/ 1,234.5 millones · US$ 0.3413 · $1.3 billion · 5.5% ...
  const montos = [...new Set(
    (textoUtil.match(/(?:S\/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|mil|millions?|billions?|MM|M|bn)\b)?|[\d]+(?:\.\d+)?\s?%/g) || [])
      .map((m) => m.trim()).filter((m) => m.length >= 3)
  )].slice(0, 8)

  const fechas = [...new Set(
    (textoUtil.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [a-záéíóu]+ de \d{4}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2},? \d{4}\b|\b\d{4}-\d{2}-\d{2}\b/gi) || [])
  )].slice(0, 6)

  const detalles = extraerDetalles(textoUtil, categoria?.clave)

  // veredicto: señales con peso + el "prior" de la categoría
  let puntaje = categoria?.prior || 0
  const razones = []
  if (categoria?.prior >= 2) razones.push(`categoría favorable (${categoria.nombre.toLowerCase()})`)
  if (categoria?.prior <= -2) razones.push(`categoría delicada (${categoria.nombre.toLowerCase()})`)
  for (const s of SENALES) {
    if (s.re.test(textoUtil)) {
      puntaje += s.peso
      razones.push((s.peso > 0 ? '🟢 ' : '🔴 ') + s.texto)
    }
  }
  if (detalles.enNegociacion) razones.push('🟡 negociación EN CURSO: todavía no hay acuerdo cerrado ni términos definidos')
  if (detalles.cambioControl) razones.push('👀 podría cambiar quién CONTROLA la empresa — de esas noticias que hay que seguir')
  let veredicto = puntaje >= 2 ? 'buena' : puntaje <= -2 ? 'mala' : 'neutra'
  // Los reportes RUTINARIOS (ej. posición mensual en derivados) mencionan
  // "pérdidas/ganancias/liquidación" como parte de sus TABLAS — eso no es
  // noticia. SIEMPRE neutra (falso 🔴 de Minsur cazado el 09-jul).
  if (categoria?.rutinario) {
    veredicto = 'neutra'
    razones.length = 0
    razones.push('es un reporte periódico rutinario (informativo, no una noticia)')
  }

  // frases clave: oraciones con montos / señales / palabras de la categoría.
  // Los saltos de línea del PDF parten oraciones a la mitad → se pegan antes.
  const cuerpo = (titulo ? textoUtil.replace(titulo, ' ') : textoUtil).replace(/\n+/g, ' ')
  const oraciones = partirOraciones(cuerpo)
    .filter((o) => o.length >= 40 && o.length <= 500 && !BOILERPLATE.test(o))
  const puntuadas = oraciones.map((o) => {
    let p = 0
    if (/(?:S\/|US\$|USD|\$)\s?\d|%/.test(o)) p += 2
    for (const s of SENALES) if (s.re.test(o)) p += 2
    if (categoria && categoria.re.test(o)) p += 1
    if (/(acuerd|aprob|inform|comunic|anunci|confirm|announce|agree|decision|decidi)/i.test(o)) p += 1
    return { o, p }
  }).filter((x) => x.p >= 2).sort((a, b) => b.p - a.p)
  let frases = puntuadas.slice(0, 5).map((x) => x.o)
  // sin frases con puntaje: el LEAD (las primeras oraciones sustanciosas) es
  // el mejor resumen honesto — antes esto quedaba VACÍO (caso Nexa-Boliden)
  if (frases.length === 0) {
    frases = oraciones.filter((o) => o.length >= 60).slice(0, 2)
  }

  return {
    empresa: empresa ? sinCola(empresa.nombre) : null,
    ticker: empresa?.ticker || null,
    categoria: categoria?.nombre || 'Comunicado al mercado (sin categoría clara)',
    categoriaClave: categoria?.clave || null,
    idioma,
    titulo,
    veredicto,
    puntaje,
    razones: razones.slice(0, 5),
    montos,
    fechas,
    frases,
    detalles,
    preguntas: PREGUNTAS_POR_CATEGORIA[categoria?.clave] || null,
    // el texto entero (recortado) viaja a Atlas para responder repreguntas
    texto: texto.slice(0, 15000),
    nombreArchivo,
    paginasLeidas: null, // lo llena el componente
    ocr: false,          // lo llena el componente si hubo OCR
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
