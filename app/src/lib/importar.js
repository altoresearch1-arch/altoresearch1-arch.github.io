import { leerImagen, leerPdf } from './sentinel'
import { buscarTicker, empresaDe, normTicker } from './cartera'

// ─────────────────────────────────────────────────────────────────────────
// 🛰 IMPORTAR CARTERA — el pipeline determinista aprobado el 16-jul
// (ARQUITECTURA_IMPORTACION_CARTERA.md): OCR primero, diccionario después.
// SIN IA: la imagen se preprocesa (§4), tesseract la lee EN el navegador
// (el mismo motor de Sentinel — el documento nunca sale del equipo), y cada
// ticker pasa por el diccionario (exacto → alias → distancia ≤ 2). Lo que
// no coincide se le pregunta al usuario, nunca se adivina.
// ─────────────────────────────────────────────────────────────────────────

// §4 — Preprocesado de imagen: la palanca más grande contra los fallos de
// OCR. Escala (tesseract rinde ~30 px por línea), escala de grises y, si el
// fondo es oscuro (plataformas de brokers), inversión a negro-sobre-blanco.
export async function preprocesarImagen(archivo) {
  const img = await new Promise((res, rej) => {
    const url = URL.createObjectURL(archivo)
    const i = new Image()
    i.onload = () => { URL.revokeObjectURL(url); res(i) }
    i.onerror = () => { URL.revokeObjectURL(url); rej(new Error('IMAGEN_ILEGIBLE')) }
    i.src = url
  })
  const factor = img.width < 1600 ? Math.min(3, Math.max(1, 1600 / img.width)) : 1
  const cv = document.createElement('canvas')
  cv.width = Math.round(img.width * factor)
  cv.height = Math.round(img.height * factor)
  const cx = cv.getContext('2d', { willReadFrequently: true })
  cx.imageSmoothingEnabled = true
  cx.imageSmoothingQuality = 'high'
  cx.drawImage(img, 0, 0, cv.width, cv.height)

  const datos = cx.getImageData(0, 0, cv.width, cv.height)
  const px = datos.data
  // luminancia media para decidir si hay que invertir (texto claro / fondo oscuro)
  let suma = 0
  for (let i = 0; i < px.length; i += 16) suma += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
  const media = suma / (px.length / 16)
  const invertir = media < 110
  for (let i = 0; i < px.length; i += 4) {
    let g = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
    if (invertir) g = 255 - g
    // un empujón de contraste alrededor del gris medio
    g = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128))
    px[i] = px[i + 1] = px[i + 2] = g
  }
  cx.putImageData(datos, 0, 0)
  return new Promise((res) => cv.toBlob((b) => res(b || archivo), 'image/png'))
}

// "7,610" → 7610 · "2.3966" → 2.3966 · "32,255.09" → 32255.09 · "1.234,56" → 1234.56
export function parseNumero(s) {
  let t = String(s || '').trim().replace(/[^\d.,-]/g, '')
  if (!t) return null
  const tienePunto = t.includes('.')
  const tieneComa = t.includes(',')
  if (tienePunto && tieneComa) {
    // el separador decimal es el que aparece AL FINAL
    if (t.lastIndexOf('.') > t.lastIndexOf(',')) t = t.replace(/,/g, '')
    else t = t.replace(/\./g, '').replace(',', '.')
  } else if (tieneComa) {
    // solo comas: miles si agrupa de a 3, decimal si no
    const partes = t.split(',')
    if (partes.length === 2 && partes[1].length !== 3) t = t.replace(',', '.')
    else t = t.replace(/,/g, '')
  }
  const n = Number(t)
  return isFinite(n) ? n : null
}

// palabras que NUNCA son un ticker (encabezados y pies típicos)
const NO_TICKER = new Set(['VALOR', 'VALORES', 'CANTIDAD', 'PPC', 'PRECIO', 'TICKER',
  'INSTRUMENTO', 'INSTRUMENTOS', 'NEMONICO', 'TOTAL', 'TOTALES', 'SUBTOTAL', 'MERCADO',
  'VALORIZACION', 'GANANCIA', 'MONEDA', 'ACCIONES', 'TITULOS', 'COSTO', 'FECHA',
  'RENTA', 'VARIABLE', 'FIJA', 'CUSTODIA', 'SALDO', 'EFECTIVO', 'PORTAFOLIO', 'CARTERA'])

// De un texto plano (OCR / PDF / CSV) → filas candidatas {crudo, cant, ppc, raw}.
// Regla: una fila de cartera arranca con algo que parece ticker y trae al
// menos un número. Cantidad = primer número; PPC = segundo (si existe).
export function extraerFilas(texto) {
  const filas = []
  for (const lineaCruda of String(texto || '').split('\n')) {
    const l = lineaCruda.replace(/[|;\t]/g, ' ').trim()
    if (!l || l.length > 220) continue
    const m = l.match(/^([A-Za-z][A-Za-z0-9.\-]{1,14})\b[\s,]*(.*)$/)
    if (!m) continue
    const crudo = normTicker(m[1])
    if (crudo.length < 3 || NO_TICKER.has(crudo)) continue
    if (!/[A-Z]{2}/.test(crudo)) continue
    const nums = (m[2].match(/-?\d[\d.,]*/g) || [])
      .map(parseNumero)
      .filter((n) => n != null && n >= 0)
    if (!nums.length) continue
    const cant = Math.floor(nums[0])
    if (cant < 1 || cant > 100000000) continue
    filas.push({ crudo, cant, ppc: nums.length > 1 ? nums[1] : null, raw: l })
  }
  // duplicados del mismo documento → fusionar (costo promedio ponderado)
  const porTicker = {}
  for (const f of filas) {
    const ya = porTicker[f.crudo]
    if (ya) {
      if (ya.ppc != null && f.ppc != null) {
        ya.ppc = (ya.cant * ya.ppc + f.cant * f.ppc) / (ya.cant + f.cant)
      } else ya.ppc = ya.ppc ?? f.ppc
      ya.cant += f.cant
    } else porTicker[f.crudo] = { ...f }
  }
  return Object.values(porTicker)
}

// Cada fila cruda pasa por el diccionario + validaciones locales (§5).
export function procesarFilas(crudas) {
  return crudas
    .map((f) => {
      const r = buscarTicker(f.crudo)
      const fila = {
        crudo: f.crudo, cant: f.cant, costo: f.ppc, raw: f.raw,
        t: r.t || f.crudo, estado: r.estado, conf: r.conf || 0,
        accion: (r.estado === 'desconocido' || r.estado === 'internacional') ? 'pendiente' : 'importar',
        faltaCosto: f.ppc == null,
        ppcSospechoso: false,
      }
      // Sanidad del PPC contra el precio real del robot (caza 2.3966 → 23.966)
      if (fila.costo != null && fila.accion === 'importar') {
        const e = empresaDe(fila.t)
        if (e?.precio != null && fila.costo > 0) {
          const razon = fila.costo / e.precio
          if (razon < 0.2 || razon > 5) fila.ppcSospechoso = true
        }
      }
      return fila
    })
    // una "desconocida" sin segundo número casi siempre es ruido del OCR
    .filter((f) => f.estado !== 'desconocido' || !f.faltaCosto || f.cant > 1)
}

// Lee el documento según su tipo y devuelve el TEXTO plano.
// onEstado(msj) va contando qué pasa (los mensajes honestos del radar).
export async function leerDocumentoCartera(archivo, onEstado) {
  const nombre = (archivo.name || '').toLowerCase()
  if (/\.(csv|txt)$/.test(nombre)) {
    onEstado?.('leyendo tu archivo de texto…')
    return archivo.text()
  }
  if (/\.(xlsx|xls)$/.test(nombre)) {
    // sin SheetJS en el bundle (dieta de la web): se pide el CSV, honesto
    throw new Error('EXCEL_NO_SOPORTADO')
  }
  if (/\.pdf$/.test(nombre) || archivo.type === 'application/pdf') {
    onEstado?.('abriendo el PDF…')
    const r = await leerPdf(archivo, onEstado)
    return r.texto
  }
  if (/\.(png|jpe?g|webp)$/.test(nombre) || /^image\//.test(archivo.type)) {
    onEstado?.('preparando la imagen (recorte de grises y contraste)…')
    const blob = await preprocesarImagen(archivo)
    const r = await leerImagen(blob, onEstado)
    return r.texto
  }
  throw new Error('TIPO_NO_SOPORTADO')
}

// Documento de ejemplo (errores REALES de OCR para que el diccionario
// demuestre su magia: MINSURII→MINSURI1, BROCALI1→BROCALC1, GLORIA1→alias).
export const DEMO_OCR = [
  { crudo: 'FERREYC1', cant: 7610, ppc: 2.3966 },
  { crudo: 'MINSURII', cant: 2200, ppc: 6.4801 },
  { crudo: 'NEXAPEC1', cant: 37457, ppc: 3.4735 },
  { crudo: 'BROCALI1', cant: 350, ppc: 18.9 },
  { crudo: 'GLORIA1', cant: 500, ppc: 10.2 },
  { crudo: 'AAPL', cant: 15, ppc: 180.0 },
  { crudo: 'IBNKQ', cant: 100, ppc: 1.5 },
  { crudo: 'PPX', cant: 3000, ppc: null },
]

export const BROKERS = [
  { n: 'BBVA Bolsa', ini: 'BB', c: '#5aa0e0', sab: 'BBVA SAB', plantilla: 'Valor · Cantidad · Precio prom. · Valorización' },
  { n: 'Credicorp Capital', ini: 'CC', c: '#7fc79a', sab: 'Credicorp Capital', plantilla: 'Instrumento · Cant. · Costo · Mercado' },
  { n: 'Magot SAB', ini: 'MG', c: '#5ab8a8', sab: 'Magot SAB', plantilla: 'Valor · Cantidad · PPC · Precio de Mercado · Valorización' },
  { n: 'Renta4', ini: 'R4', c: '#e0915a', sab: 'Renta4', plantilla: 'Ticker · Títulos · Precio medio' },
  { n: 'Kallpa SAB', ini: 'KA', c: '#e0c95a', sab: 'Kallpa SAB', plantilla: 'Instrumento · Cantidad · Precio · Creación' },
  { n: 'Inteligo SAB', ini: 'IN', c: '#9a8fd0', sab: 'Inteligo SAB', plantilla: 'Valor · Nominal · Costo unit.' },
  { n: 'Scotia Bolsa', ini: 'SC', c: '#d07a7a', sab: 'Scotia Bolsa', plantilla: 'Instrumento · Cantidad · Costo' },
  { n: 'Otro broker', ini: '✎', c: '#8a8a80', sab: 'Otra', plantilla: null },
]
