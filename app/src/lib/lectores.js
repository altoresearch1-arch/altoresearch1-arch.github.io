import { leerPdf, leerImagen } from './sentinel'

// ─────────────────────────────────────────────────────────────────────────
// 📖 LECTORES — un lector por formato para la Biblioteca de Sentinel.
// PDF y fotos ya los resuelve sentinel.js (pdf.js + OCR). Aquí se suman
// Word (.docx), Excel (.xlsx), PowerPoint (.pptx) y texto plano (.txt/.csv).
//
// Todo corre EN el navegador: el archivo no se sube a ningún lado. Las
// librerías pesadas (JSZip para docx/pptx, SheetJS para xlsx) llegan por CDN
// con import dinámico → cero peso en el bundle y en el precache de la PWA
// (misma jugada que el OCR). Cada lector devuelve el texto CON su ubicación
// (página · sección · hoja · diapositiva) para que Atlas pueda CITAR.
//
// Contrato de salida: { tipo, texto, paginas, ocr, unidades }
//   unidades = [{ pagina?, seccion?, texto }]  ← de aquí salen chunks y citas
// ─────────────────────────────────────────────────────────────────────────

const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm'
const SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'
const MAX_CHARS_DOC = 60000 // mismo tope que el robot: un doc gigante se recorta

const limpiar = (t) => String(t || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

async function cargarCdn(url, errorSinRed) {
  try {
    return await import(/* @vite-ignore */ url)
  } catch {
    throw new Error(errorSinRed) // las librerías vienen de un CDN: sin red no hay lectura
  }
}

async function abrirZip(archivo) {
  const mod = await cargarCdn(JSZIP_CDN, 'LECTOR_SIN_INTERNET')
  const JSZip = mod.default || mod
  try {
    return await JSZip.loadAsync(await archivo.arrayBuffer())
  } catch {
    throw new Error('ARCHIVO_ROTO')
  }
}

const parsearXml = (s) => new DOMParser().parseFromString(s, 'application/xml')

// ── Word (.docx): párrafos de word/document.xml; los estilos "Heading/Título"
//    parten SECCIONES (la cita sale "Archivo.docx · Sección «Resultados»")
export async function leerDocx(archivo, onEstado) {
  onEstado?.('abriendo el documento de Word…')
  const zip = await abrirZip(archivo)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('ARCHIVO_ROTO')
  const dom = parsearXml(xml)
  const unidades = []
  let seccion = null
  let acumulado = []
  const cerrar = () => {
    const texto = limpiar(acumulado.join('\n'))
    if (texto) unidades.push({ seccion, texto })
    acumulado = []
  }
  for (const p of dom.getElementsByTagName('w:p')) {
    const estilo = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || ''
    const textoP = [...p.getElementsByTagName('w:t')].map((t) => t.textContent).join('')
    if (!textoP.trim()) continue
    if (/^(heading|t[ií]tulo|title)/i.test(estilo)) {
      cerrar()
      seccion = textoP.trim().slice(0, 60)
      continue
    }
    acumulado.push(textoP)
  }
  cerrar()
  if (!unidades.length) throw new Error('ARCHIVO_VACIO')
  const texto = unidades.map((u) => (u.seccion ? u.seccion + '\n' : '') + u.texto).join('\n\n').slice(0, MAX_CHARS_DOC)
  return { tipo: 'docx', texto, paginas: null, ocr: false, unidades }
}

// ── PowerPoint (.pptx): texto de cada diapositiva (ppt/slides/slideN.xml)
export async function leerPptx(archivo, onEstado) {
  onEstado?.('abriendo la presentación…')
  const zip = await abrirZip(archivo)
  const rutas = Object.keys(zip.files)
    .filter((r) => /^ppt\/slides\/slide\d+\.xml$/.test(r))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
  const unidades = []
  for (const ruta of rutas) {
    const n = parseInt(ruta.match(/slide(\d+)/)[1], 10)
    const dom = parsearXml(await zip.file(ruta).async('string'))
    const textoSlide = limpiar([...dom.getElementsByTagName('a:t')].map((t) => t.textContent).join('\n'))
    if (textoSlide) unidades.push({ pagina: n, seccion: `Diapositiva ${n}`, texto: textoSlide })
  }
  if (!unidades.length) throw new Error('ARCHIVO_VACIO')
  const texto = unidades.map((u) => u.texto).join('\n\n').slice(0, MAX_CHARS_DOC)
  return { tipo: 'pptx', texto, paginas: rutas.length, ocr: false, unidades }
}

// ── Excel (.xlsx/.xls): cada hoja a texto tipo CSV (SheetJS por CDN)
export async function leerXlsx(archivo, onEstado) {
  onEstado?.('abriendo la hoja de cálculo…')
  const XLSX = await cargarCdn(SHEETJS_CDN, 'LECTOR_SIN_INTERNET')
  let libro
  try {
    libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' })
  } catch {
    throw new Error('ARCHIVO_ROTO')
  }
  const unidades = []
  for (const nombre of libro.SheetNames.slice(0, 12)) {
    const csv = XLSX.utils.sheet_to_csv(libro.Sheets[nombre], { blankrows: false })
    const textoHoja = limpiar(csv.split('\n').slice(0, 300).join('\n')) // tope sano por hoja
    if (textoHoja) unidades.push({ seccion: `Hoja «${nombre}»`, texto: textoHoja })
  }
  if (!unidades.length) throw new Error('ARCHIVO_VACIO')
  const texto = unidades.map((u) => u.seccion + '\n' + u.texto).join('\n\n').slice(0, MAX_CHARS_DOC)
  return { tipo: 'xlsx', texto, paginas: null, ocr: false, unidades }
}

// ── Texto plano (.txt/.csv)
export async function leerTxt(archivo) {
  const texto = limpiar(await archivo.text()).slice(0, MAX_CHARS_DOC)
  if (texto.length < 20) throw new Error('ARCHIVO_VACIO')
  return { tipo: 'txt', texto, paginas: null, ocr: false, unidades: [{ seccion: null, texto }] }
}

export const TIPOS_ACEPTADOS = 'application/pdf,.pdf,image/*,.docx,.pptx,.xlsx,.xls,.txt,.csv'

export function tipoDe(archivo) {
  const nombre = archivo.name.toLowerCase()
  if (/\.pdf$/.test(nombre) || archivo.type === 'application/pdf') return 'pdf'
  if (/^image\//.test(archivo.type) || /\.(png|jpe?g|webp|bmp|gif)$/.test(nombre)) return 'imagen'
  if (/\.docx$/.test(nombre)) return 'docx'
  if (/\.pptx$/.test(nombre)) return 'pptx'
  if (/\.xlsx?$/.test(nombre)) return 'xlsx'
  if (/\.(txt|csv)$/.test(nombre)) return 'txt'
  return null
}

// La puerta única: recibe cualquier archivo soportado y devuelve el contrato común
export async function leerArchivo(archivo, onEstado) {
  const tipo = tipoDe(archivo)
  if (!tipo) throw new Error('FORMATO_NO_SOPORTADO')
  if (tipo === 'pdf') {
    const r = await leerPdf(archivo, onEstado)
    return {
      tipo: 'pdf', texto: r.texto.slice(0, MAX_CHARS_DOC), paginas: r.paginas, ocr: r.ocr,
      unidades: (r.porPagina || []).map((p) => ({ pagina: p.n, seccion: null, texto: p.texto })),
    }
  }
  if (tipo === 'imagen') {
    const r = await leerImagen(archivo, onEstado)
    return {
      tipo: 'imagen', texto: r.texto, paginas: 1, ocr: true,
      unidades: [{ pagina: 1, seccion: null, texto: r.texto }],
    }
  }
  if (tipo === 'docx') return leerDocx(archivo, onEstado)
  if (tipo === 'pptx') return leerPptx(archivo, onEstado)
  if (tipo === 'xlsx') return leerXlsx(archivo, onEstado)
  return leerTxt(archivo)
}
