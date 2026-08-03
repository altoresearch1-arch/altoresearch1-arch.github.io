import { useCallback, useEffect, useRef, useState } from 'react'
import preciosData from '../data/precios.json'

// ═════════════════════════════════════════════════════════════════════════
// 🔴 EL MERCADO EN VIVO — la app le pregunta a la BVL, sin intermediarios.
//
// Hasta hoy el precio venía HORNEADO adentro del sitio: precios.json se
// importaba como código y terminaba dentro del bundle, así que para cambiar
// un número había que recompilar y republicar la página entera. Resultado:
// el robot bajaba precio cada 10 minutos, pero la web solo se rehacía a las
// :03 y :33 — hasta media hora de rezago.
//
// Esto lo salta: el navegador del usuario le pregunta DIRECTO al mismo
// endpoint que usa el robot (y que usa la propia bvl.com.pe). Se comprobó el
// 03-ago-2026 desde altoresearch1-arch.github.io y responde 200:
//
//   Access-Control-Allow-Origin: *
//
// DOS DETALLES QUE COSTARON ENCONTRAR Y QUE NO SE PUEDEN TOCAR:
//
//   1. El preflight (OPTIONS) contesta `Access-Control-Allow-Methods:
//      GET,OPTIONS,PUT,DELETE,PATCH` — POST NO ESTÁ EN LA LISTA. Igual
//      funciona porque POST es un método "safelisted" del estándar CORS y no
//      necesita estar declarado. Si alguna vez esto falla, el problema no es
//      el método.
//   2. Content-Type TIENE que ser application/json. Con `text/plain` (que
//      sería un "simple request" y se ahorraría el preflight) el endpoint
//      responde 415. O sea: el preflight es obligatorio, y pasa.
//
// LO QUE ESTO NO REEMPLAZA: al robot. Él sigue construyendo el histórico de
// cierres (que es de donde sale el vaivén de cada acción) y sigue siendo lo
// que ve alguien que abre la app un domingo. Esto es una CAPA ENCIMA: mientras
// hay rueda, el precio de arriba es de hace segundos en vez de hace media
// hora. Cuando la BVL no contesta, todo cae solo al dato horneado de siempre.
// ═════════════════════════════════════════════════════════════════════════

const URL_BVL = 'https://dataondemand.bvl.com.pe/v1/stock-quote/market'

// Perú es UTC-5 todo el año (no hay horario de verano), igual que asume el
// extractor. Por eso alcanza con restarle 5 horas al UTC y leer los campos
// UTC del resultado: no hace falta ninguna librería de zonas horarias.
const LIMA_MS = 5 * 3600000

const RUEDA_ABRE = 9 * 60         // 9:00
const RUEDA_CIERRA = 16 * 60 + 15 // 16:15 — 15 min de gracia para el cierre

// Cada cuánto se vuelve a preguntar mientras hay rueda. 45 s es un punto
// medio pensado, no un número al azar: el endpoint devuelve el mercado ENTERO
// en una sola llamada (~115 cotizaciones), así que preguntar más seguido no
// trae más dato, solo más ruido contra un servidor que no es nuestro. Y para
// la mayoría de la BVL es de sobra — Siderperú hizo 13 operaciones en toda una
// rueda: refrescarla cada segundo sería teatro.
const CADA_MS = 45000

// Tras un fallo se espera más, y va creciendo. Si la BVL se cayó, insistir
// cada 45 s no la levanta.
const ESPERA_FALLO = [60000, 120000, 300000]

export function partesLima(d = new Date()) {
  const t = new Date(d.getTime() - LIMA_MS)
  return {
    fecha: t.toISOString().slice(0, 10),
    dia: t.getUTCDay(),                                   // 0 = domingo
    minutos: t.getUTCHours() * 60 + t.getUTCMinutes(),
    hora: t.toISOString().slice(11, 19),
  }
}

// ¿Está abierta la rueda AHORA? Fuera de esto se consulta una sola vez (para
// tener el último cierre fresco) y se deja de insistir: golpear a la BVL un
// domingo a las 3 de la mañana no le sirve a nadie.
export function hayRueda(d = new Date()) {
  const { dia, minutos } = partesLima(d)
  return dia >= 1 && dia <= 5 && minutos >= RUEDA_ABRE && minutos <= RUEDA_CIERRA
}

// Los números llegan a veces como texto ('262918', '69', '0 '). Mismo criterio
// que num() en extractor/fetch_precios.py.
function num(v) {
  if (v == null) return null
  const n = parseFloat(String(v).trim().replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

// '2026-07-31T19:59:42' (UTC) -> '2026-07-31T14:59:42-05:00'
// Espejo exacto de hora_lima() en el extractor: la app ya lee ese formato con
// .slice(11,16) para la hora y .slice(0,10) para la sesión.
function horaLima(iso) {
  if (!iso || !iso.includes('T')) return null
  const t = new Date(iso.endsWith('Z') ? iso : `${iso.replace('Z', '')}Z`)
  if (Number.isNaN(t.getTime())) return null
  return `${new Date(t.getTime() - LIMA_MS).toISOString().slice(0, 19)}-05:00`
}

// nemónico de la BVL -> ticker nuestro. El mapa sale de precios.json, que ya
// guarda el nemónico de cada empresa: no hace falta subir empresas_config.json
// al front solo para esto.
const POR_NEMONICO = new Map()
for (const [ticker, p] of Object.entries(preciosData.precios || {})) {
  if (p?.nemonico) POR_NEMONICO.set(p.nemonico, ticker)
}

// Una fila cruda de la BVL -> la MISMA forma que escribe fetch_precios.py.
// Que sea idéntica es lo que permite que el resto de la app no se entere de
// nada: para radar.js este objeto y el horneado son intercambiables.
function normalizar(row) {
  const last = row.last
  const lastDt = row.lastDate
  const previo = row.previous
  const prevDt = row.previousDate
  const monto = num(row.negotiatedAmount) || 0
  const ops = num(row.operationsNumber)
  // 'last' = último precio REALMENTE transado. 'sell' es la orden de venta
  // parada en pantalla, NO una transacción -> nunca usar 'sell'.
  const negoHoy = monto > 0 || (ops != null && ops > 0)
  const precio = last != null ? last : previo
  const fecha = last != null ? ((lastDt || '').slice(0, 10) || prevDt) : prevDt

  return {
    nemonico: row.nemonico,
    precio,
    previo,
    moneda: row.currency,
    fecha,
    sinNegociacionReciente: !negoHoy,
    ultimaOperacion: horaLima(lastDt),
    apertura: row.opening,
    minimo: row.minimun,
    maximo: row.maximun,
    operaciones: Math.trunc(ops || 0),
    montoNegociado: monto || null,
    cantidadNegociada: num(row.negotiatedQuantity),
    variacionPct: row.percentageChange,
    fuente: 'BVL — movimientos diarios (en vivo, desde el navegador)',
    encontrado: true,
    envivo: true,
  }
}

// Una llamada: trae el mercado entero. Devuelve { precios, filas } o lanza.
export async function bajarMercadoVivo({ signal } = {}) {
  const r = await fetch(URL_BVL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal,
  })
  if (!r.ok) throw new Error(`BVL respondió ${r.status}`)
  const doc = await r.json()
  const filas = Array.isArray(doc?.content) ? doc.content : []

  const precios = {}
  for (const row of filas) {
    const ticker = POR_NEMONICO.get(row?.nemonico)
    if (!ticker) continue
    const p = normalizar(row)
    if (p.precio != null) precios[ticker] = p
  }
  return { precios, filas: filas.length, tickers: Object.keys(precios).length }
}

// ── El hook que usa el Radar ─────────────────────────────────────────────
//
// ESTADOS, y cada uno dice una cosa distinta al usuario:
//   'inicial'   — todavía no preguntamos
//   'vivo'      — hay dato fresco de la BVL
//   'vacio'     — la BVL contestó bien pero SIN cotizaciones. Pasa de verdad:
//                 el 03-ago-2026 su propia web decía "En este momento, no hay
//                 datos disponibles". No es un error nuestro y no se puede
//                 mostrar como si lo fuera.
//   'cerrado'   — fuera de rueda; se consultó una vez y se dejó de insistir
//   'error'     — no se pudo llegar (red, CORS, la BVL caída)
//
// En 'vacio', 'cerrado' y 'error' la app sigue funcionando con el precio
// horneado de siempre: nunca se queda en blanco.
export function useMercadoVivo({ activo = true, cada = CADA_MS } = {}) {
  const [estado, setEstado] = useState('inicial')
  const [precios, setPrecios] = useState(null)
  const [actualizado, setActualizado] = useState(null)
  const [error, setError] = useState(null)

  const fallos = useRef(0)
  const timer = useRef(null)
  const aborta = useRef(null)
  const vivo = useRef(true)

  const consultar = useCallback(async () => {
    if (!vivo.current) return
    aborta.current?.abort()
    const ac = new AbortController()
    aborta.current = ac
    try {
      const { precios: p, tickers } = await bajarMercadoVivo({ signal: ac.signal })
      if (!vivo.current || ac.signal.aborted) return
      fallos.current = 0
      setError(null)
      setActualizado(partesLima().hora)
      if (tickers > 0) {
        setPrecios(p)
        setEstado(hayRueda() ? 'vivo' : 'cerrado')
      } else {
        // Sin cotizaciones no se pisa lo que ya teníamos: un archivo viejo es
        // mejor que una pantalla vacía.
        setEstado('vacio')
      }
    } catch (e) {
      if (ac.signal.aborted || !vivo.current) return
      fallos.current += 1
      setError(e?.message || String(e))
      setEstado('error')
    }
  }, [])

  useEffect(() => {
    vivo.current = true
    if (!activo) return undefined

    const agendar = () => {
      clearTimeout(timer.current)
      // Fuera de rueda no se reagenda: ya se consultó una vez al montar y el
      // mercado no se va a mover hasta mañana.
      if (!hayRueda()) return
      const espera = fallos.current
        ? ESPERA_FALLO[Math.min(fallos.current - 1, ESPERA_FALLO.length - 1)]
        : cada
      timer.current = setTimeout(async () => {
        // Con la pestaña de fondo no se consulta: nadie lo está mirando y
        // sería gastar batería y llamadas ajenas para nada.
        if (!document.hidden) await consultar()
        agendar()
      }, espera)
    }

    consultar().then(agendar)

    // Al volver a la pestaña se refresca en el acto: lo que se ve al mirar
    // tiene que ser de ahora, no de cuando la dejaste de fondo.
    const alVolver = () => {
      if (!document.hidden && hayRueda()) consultar().then(agendar)
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      vivo.current = false
      clearTimeout(timer.current)
      aborta.current?.abort()
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [activo, cada, consultar])

  return { precios, estado, actualizado, error, refrescar: consultar }
}
