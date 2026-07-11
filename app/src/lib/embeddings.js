// ─────────────────────────────────────────────────────────────────────────
// 🔢 EMBEDDINGS SEMÁNTICOS — la búsqueda "por significado" (no por palabras).
//
// Corre EN el navegador con transformers.js (modelo multilingüe ES/EN). El
// modelo llega por CDN con import dinámico y se cachea en el navegador
// (IndexedDB) — misma jugada que el OCR (tesseract) y los lectores (JSZip/
// SheetJS): CERO peso en el bundle y en el precache de la PWA.
//
// PRIVACIDAD (pilar de ALTO): lo ÚNICO que se descarga es el MODELO (pesos
// públicos), como bajar una librería. Los DOCUMENTOS y las PREGUNTAS del
// usuario se procesan localmente y NUNCA salen del equipo.
//
// Sin red / navegador viejo → los que llaman caen a BM25 (biblioteca.js);
// la app nunca se rompe por esto.
// ─────────────────────────────────────────────────────────────────────────

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
// e5-small: multilingüe (clave: preguntas en español sobre PDF en inglés),
// liviano y cuantizado. Requiere prefijos "query:" / "passage:".
const MODELO = 'Xenova/multilingual-e5-small'

let extractorPromise = null
let estado = 'frio' // frio | cargando | listo | error
let progreso = 0

export const estadoEmbeddings = () => ({ estado, progreso })
export const embeddingsListo = () => estado === 'listo'

async function obtenerExtractor(onProgreso) {
  if (extractorPromise) return extractorPromise
  estado = 'cargando'
  extractorPromise = (async () => {
    // el "+esm" arma el bundle ESM del paquete; los pesos del modelo se bajan
    // del hub de Hugging Face y quedan cacheados en el navegador
    const mod = await import(/* @vite-ignore */ `${TRANSFORMERS_CDN}/+esm`)
    const { pipeline, env } = mod
    env.allowLocalModels = false      // no buscar el modelo en nuestro server
    env.useBrowserCache = true        // cachear pesos en el navegador (IndexedDB)
    const ext = await pipeline('feature-extraction', MODELO, {
      quantized: true,
      progress_callback: (p) => {
        if (p && p.status === 'progress' && typeof p.progress === 'number') {
          progreso = Math.max(progreso, Math.round(p.progress))
          onProgreso?.(`descargando el modelo de análisis… ${progreso}% (solo la 1ª vez)`)
        }
      },
    })
    estado = 'listo'; progreso = 100
    return ext
  })().catch((e) => {
    estado = 'error'; extractorPromise = null
    throw e
  })
  return extractorPromise
}

// arranca la carga sin bloquear (para precargar al abrir la biblioteca)
export function precargarEmbeddings(onProgreso) {
  obtenerExtractor(onProgreso).catch(() => { /* silencioso: hay fallback BM25 */ })
}

// e5 pide prefijos distintos para preguntas y para pasajes
async function vectorizar(textos, prefijo, onProgreso) {
  const ext = await obtenerExtractor(onProgreso)
  const entradas = textos.map((t) => `${prefijo}: ${String(t).slice(0, 512)}`)
  const salida = await ext(entradas, { pooling: 'mean', normalize: true })
  return salida.tolist() // vectores YA normalizados (norma 1)
}

export async function vectorizarPasajes(textos, onProgreso) {
  if (!textos.length) return []
  return vectorizar(textos, 'passage', onProgreso)
}

export async function vectorizarPregunta(texto, onProgreso) {
  return (await vectorizar([texto], 'query', onProgreso))[0]
}

// coseno = producto punto (ambos vectores están normalizados)
export function coseno(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
