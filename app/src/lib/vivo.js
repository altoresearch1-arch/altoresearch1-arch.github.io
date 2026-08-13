import { useCallback, useEffect, useRef, useState } from 'react'
import preciosData from '../data/precios.json'
import { mapaRpj } from './hechos'
import { usarNoticiasFrescas } from './radar'

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
// 📄 Los Hechos de Importancia salen del MISMO host, y por eso también pasan
// el CORS. La prensa no: se probaron los 8 feeds del robot desde el dominio
// real (03-ago-2026) y 7 los bloquea el navegador — Google News, Gestión, El
// Comercio, Rumbo Minero, Energiminas, Bloomberg Línea y FXStreet. Solo El
// País deja leer. O sea que la prensa SIGUE necesitando al robot; el Hecho
// oficial, no.
//
// Y el Hecho es justamente el que importa para esto: el propio repo midió
// (31-jul-2026) que los titulares LLEGAN DESPUÉS del Hecho de Importancia.
// Acá se gana la noticia en su primer minuto, no cuando la prensa la levanta.
const URL_HECHOS = 'https://dataondemand.bvl.com.pe/v1/corporate-actions'
// Sin rpjCode el endpoint devuelve el mercado ENTERO: 174 Hechos de los
// últimos 6 días entraron en una sola página. Preguntar empresa por empresa
// serían 152 llamadas por vuelta y sería inaceptable desde un navegador.
const HECHOS_DIAS = 7
const HECHOS_SIZE = 300

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

// rpjCode de la BVL -> ticker nuestro. Sale de hechos.json, que ya guarda el
// rpj de cada empresa (lib/hechos.js es quien lee ese archivo).
const POR_RPJ = mapaRpj()

const menosDias = (iso, n) =>
  new Date(new Date(`${iso}T12:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10)

// ── 📄 LOS HECHOS DE IMPORTANCIA, EN SU PRIMER MINUTO ────────────────────
// Devuelve { TICKER: [hecho, …] } con los más recientes primero. Solo los
// últimos días: lo viejo ya vive en hechos.json y no hace falta traerlo dos
// veces.
export async function bajarHechosVivos({ signal, dias = HECHOS_DIAS } = {}) {
  const hoy = partesLima().fecha
  const r = await fetch(URL_HECHOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: 1, size: HECHOS_SIZE, search: '',
      startDate: menosDias(hoy, dias), endDate: hoy,
    }),
    signal,
  })
  if (!r.ok) throw new Error(`BVL (hechos) respondió ${r.status}`)
  const doc = await r.json()

  const porTicker = {}
  for (const it of doc?.content || []) {
    const ticker = POR_RPJ.get(it?.rpjCode)
    if (!ticker) continue
    const reg = it.registerDate || ''
    const fecha = reg.slice(0, 10)
    if (!fecha) continue
    const titulo = (it.observation || '').trim()
    const categoria = (it.codes?.[0]?.descCodeHHII || '').trim()
    // Mismo criterio que fetch_hechos.py: muchos HI llegan con observation en
    // blanco y ahí la CATEGORÍA es el contenido (el de Petroperú del 02-ago
    // es uno). Exigir título los botaría.
    if (!titulo && !categoria) continue
    const ruta = it.documents?.[0]?.path
    const h = { fecha, titulo, categoria, envivo: true }
    // La HORA, que el archivo horneado tira: recorta registerDate a 10
    // caracteres. Saber que un Hecho salió 07:08 y no "hoy" es la diferencia
    // entre explicar la rueda y llegar tarde a mirarla.
    if (reg.length >= 16) h.hora = reg.slice(11, 16)
    if (ruta) h.pdf = `https://documents.bvl.com.pe${ruta}`
    ;(porTicker[ticker] ||= []).push(h)
  }
  for (const lista of Object.values(porTicker)) {
    lista.sort((a, b) => (`${b.fecha} ${b.hora || ''}`).localeCompare(`${a.fecha} ${a.hora || ''}`))
  }
  return porTicker
}

// ── 📈 LAS RUEDAS QUE LE FALTAN AL ARCHIVO ───────────────────────────────
//
// El histórico de cierres sale del mismo host y también pasa el CORS:
//   GET /v1/stock-quote/share-values/{NEMONICO}?startDate=&endDate=
//
// Esto NO es para tener el histórico en vivo — los cierres viejos no cambian,
// y recalcular la volatilidad cada 45 s sería absurdo. Es para REPARAR el
// hueco cuando el robot lleva días sin correr: sin esto, «dos semanas» mide
// desde una fecha vieja hasta otra fecha vieja, y toda la fuerza del Sonar
// queda corrida.
//
// Va de a pocos y una sola vez por visita: son ~45 llamadas y no hay ninguna
// razón para repetirlas — un cierre ya cerrado no se mueve.
const CONCURRENCIA = 6

async function enTandas(items, n, fn) {
  const salida = []
  for (let i = 0; i < items.length; i += n) {
    salida.push(...await Promise.all(items.slice(i, i + n).map(fn)))
  }
  return salida
}

export async function bajarColaHistorica({ tickers, desde, hasta, signal } = {}) {
  const pide = async (ticker) => {
    const nem = preciosData.precios?.[ticker]?.nemonico
    if (!nem) return null
    try {
      const r = await fetch(
        `https://dataondemand.bvl.com.pe/v1/stock-quote/share-values/${encodeURIComponent(nem)}`
        + `?startDate=${desde}&endDate=${hasta}`,
        { signal },
      )
      if (!r.ok) return null
      const d = await r.json()
      // Los valores vienen como texto ("2.183"): a número acá, que es donde
      // se sabe de dónde salieron.
      const vals = (d?.values || [])
        .map(([f, v]) => [f, Number(v)])
        .filter(([f, v]) => f && Number.isFinite(v) && v > 0)
      return vals.length ? [ticker, vals] : null
    } catch { return null }
  }
  const pares = (await enTandas(tickers, CONCURRENCIA, pide)).filter(Boolean)
  return Object.fromEntries(pares)
}

// ── 📰 LA PRENSA, POR EL CAMINO CORTO ────────────────────────────────────
//
// Los titulares NO se pueden pedir desde el navegador: se probaron 18 medios
// desde el dominio real (03-ago-2026) y 16 lo bloquean — Gestión, El
// Comercio, La República, Andina, RPP, El Peruano, Perú21, Infomercado,
// Semana Económica, Rumbo Minero, Energiminas, Proactivo, Bloomberg Línea,
// FXStreet, Investing y Google News. Solo pasan Yahoo Finanzas y El País, que
// son internacionales y no cubren la BVL. Ahí no hay vuelta: para la prensa
// el robot es insustituible.
//
// PERO el recorrido tenía DOS patas, no una. La prensa viaja
//   robot -> commit al repo -> despliegue de Pages -> tu pantalla
// y la app solo la veía al final del todo, porque noticias.json venía
// horneado dentro del bundle. Este atajo se salta el despliegue entero:
// raw.githubusercontent sirve el archivo del repo con CORS abierto
// (comprobado), así que los titulares aparecen apenas el robot los commitea,
// aunque la web no se haya vuelto a publicar.
//
// Si falla —sin red, GitHub caído, o el archivo aún no existe— no pasa nada:
// se sigue con la copia horneada, que es exactamente lo que había antes.
const RAW = 'https://raw.githubusercontent.com/altoresearch1-arch/'
  + 'altoresearch1-arch.github.io/main/app/src/data/'

// Cada 5 min. El robot no commitea prensa más seguido que eso, y raw tiene su
// propio caché de unos minutos: preguntar más sería pedirle lo mismo.
const PRENSA_MS = 5 * 60000

export async function bajarNoticiasDelRepo({ signal } = {}) {
  const r = await fetch(`${RAW}noticias.json`, { cache: 'no-store', signal })
  if (!r.ok) throw new Error(`raw noticias.json ${r.status}`)
  return r.json()
}

// Devuelve un número que sube cada vez que ENTRA una copia más nueva. Sirve
// para que React sepa que tiene que repintar: los titulares viven en un
// módulo, no en el estado.
export function useNoticiasFrescas({ activo = true, cada = PRENSA_MS } = {}) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!activo) return undefined
    let seguir = true
    const ac = new AbortController()

    const mirar = async () => {
      try {
        const doc = await bajarNoticiasDelRepo({ signal: ac.signal })
        if (seguir && usarNoticiasFrescas(doc)) setVersion((v) => v + 1)
      } catch { /* se sigue con la copia horneada */ }
    }

    mirar()
    const id = setInterval(() => { if (!document.hidden) mirar() }, cada)
    return () => { seguir = false; ac.abort(); clearInterval(id) }
  }, [activo, cada])

  return version
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
  const [hechos, setHechos] = useState(null)
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
    // Las dos llamadas van juntas y NINGUNA puede tumbar a la otra: que la
    // BVL no publique cotizaciones (le pasa) no es razón para quedarse sin
    // los Hechos, y al revés igual.
    const [mercado, hi] = await Promise.allSettled([
      bajarMercadoVivo({ signal: ac.signal }),
      bajarHechosVivos({ signal: ac.signal }),
    ])
    if (!vivo.current || ac.signal.aborted) return

    if (hi.status === 'fulfilled' && Object.keys(hi.value).length) setHechos(hi.value)

    if (mercado.status === 'fulfilled') {
      fallos.current = 0
      setError(null)
      setActualizado(partesLima().hora)
      if (mercado.value.tickers > 0) {
        setPrecios(mercado.value.precios)
        setEstado(hayRueda() ? 'vivo' : 'cerrado')
      } else {
        // Sin cotizaciones no se pisa lo que ya teníamos: un archivo viejo es
        // mejor que una pantalla vacía.
        setEstado('vacio')
      }
      return
    }

    fallos.current += 1
    setError(mercado.reason?.message || String(mercado.reason))
    setEstado('error')
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

  return { precios, hechos, estado, actualizado, error, refrescar: consultar }
}

// Repara el hueco UNA vez por visita. `hueco` es lo que devuelve
// huecoHistorico() de lib/radar.js: los tickers que el Radar usa y la última
// fecha que el archivo alcanzó a guardar.
export function useColaHistorica(hueco) {
  const [cola, setCola] = useState(null)
  const [reparando, setReparando] = useState(false)
  const yaFue = useRef(false)

  const { tickers, ultima } = hueco || {}

  useEffect(() => {
    if (yaFue.current || !ultima || !tickers?.length) return undefined
    const hasta = partesLima().fecha
    // OJO: `startDate` de la BVL es EXCLUSIVO — comprobado el 03-ago-2026.
    // Pedir desde el 31 devuelve [] y pedir desde el 30 devuelve el 31. Por
    // eso se manda la última fecha QUE YA TENEMOS, sin sumarle un día: sumarlo
    // se saltaba justo la rueda que faltaba.
    const desde = ultima
    // El archivo ya está al día: no se pide nada. Es el caso normal cuando el
    // robot corrió anoche, y entonces esto no cuesta ni una llamada.
    if (desde >= hasta) return undefined

    yaFue.current = true
    const ac = new AbortController()
    setReparando(true)
    bajarColaHistorica({ tickers, desde, hasta, signal: ac.signal })
      .then((c) => { if (!ac.signal.aborted && Object.keys(c).length) setCola(c) })
      .finally(() => { if (!ac.signal.aborted) setReparando(false) })
    return () => ac.abort()
  }, [tickers, ultima])

  return { cola, reparando }
}
