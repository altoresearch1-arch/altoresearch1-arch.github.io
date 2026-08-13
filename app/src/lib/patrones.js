import empresasData from '../data/empresas.json'
import { hechosDe } from './hechos'
import { productoDe } from './cotizacion'

// ═════════════════════════════════════════════════════════════════════════
// 🧭 LOS PATRONES — las cuatro preguntas que el Sonar todavía no respondía
//
// El Radar mide cuánto se salió una acción de su vaivén. Eso contesta «¿se
// movió?». Estas cuatro contestan «¿por qué se movió AHÍ y no en otro lado»,
// y las cuatro salen del mismo cajón que ya baja el robot:
//
//   1. ¿el día está partido en dos metales?   → el metal de cada ticker
//                                                (cotizacion.js) + los cierres
//   2. ¿la noticia salió con la rueda cerrada? → la hora del Hecho de
//                                                Importancia (hechos.json)
//   3. ¿el tramo está estirado?                → RSI de la propia serie
//   4. ¿cotiza más barata afuera?              → la única que pide un dato
//                                                nuevo (ver GEMELAS)
//
// SE MANTIENE LA REGLA DE ORO: acá no se recomienda nada. Cada marca lleva su
// cuenta escrita al lado para que se pueda comprobar, y ninguna dice qué
// hacer. «RSI 88» es una descripción del tramo que YA ocurrió, igual que
// «lleva 4 ruedas subiendo»; no es un pronóstico.
//
// De dónde salió cada regla: sesión del 7-ago-2026, con la nómina no agrícola
// de EE.UU. en −23 000 contra +85 000 esperado. Ese día el oro subió 2.37% y
// la plata 3.56% mientras el cobre caía 1.85% y el zinc 1.71%, y las tres
// acciones que mirábamos se ordenaron por su metal y no por su balance. El
// mismo día se vio que el Hecho con los resultados de Nexa se presentó a las
// 20:19 del 5-ago —con la rueda cerrada— y que Lima recién lo pagó el 6.
// ═════════════════════════════════════════════════════════════════════════

const EMPRESAS = new Map(empresasData.empresas.map((e) => [e.ticker, e]))

// ── 1. EL METAL MANDA ────────────────────────────────────────────────────
//
// Dos familias que se mueven por motivos OPUESTOS y que un día de dato macro
// separa en seco: los preciosos son refugio (les gusta la tasa que baja) y los
// industriales son crecimiento (les gusta la fábrica que produce). Cuando la
// mediana de una familia va para arriba y la de la otra para abajo, el día no
// lo hizo ninguna empresa: lo hizo el metal.
//
// EL METAL SALE DE cotizacion.js, no de un mapa nuevo: ahí está curado a mano
// contra las minas de cada empresa y es el que ya usa la ficha. Lo único que
// se agrega acá es el SEGUNDO metal, que aquella tabla no tiene porque su
// contrato es «un precio por empresa» — pero Volcan vende zinc Y plata, y el
// 7-ago-2026 subió con la plata mientras su zinc caía. Sin esta línea el
// Radar lo hubiera clasificado como industrial y habría leído el día al revés.
const SEGUNDO_METAL = {
  VOLCABC1: 'plata', // zinc-plata-plomo (Yauli, Chungar, Alpamarca)
  NEXAPEC1: 'plata', // el zinc manda, pero la plata es subproducto de El Porvenir y Atacocha
  ATACOBC1: 'plata',
  BROCALC1: 'plata', // cobre-plata-zinc
}

const FAMILIA = {
  oro: 'precioso', plata: 'precioso',
  cobre: 'industrial', zinc: 'industrial', plomo: 'industrial', estano: 'industrial',
}

// Los metales de una acción: el principal primero. Devuelve [] si la empresa
// no vive de un metal — una eléctrica no entra a este cálculo ni de adorno.
export function metalesDe(ticker) {
  const clave = productoDe(EMPRESAS.get(ticker))?.clave
  const metales = []
  if (clave && FAMILIA[clave]) metales.push(clave)
  const segundo = SEGUNDO_METAL[ticker]
  if (segundo && FAMILIA[segundo] && segundo !== clave) metales.push(segundo)
  return metales
}

// La familia de la acción. Con dos metales de familias distintas (Volcan) no
// se elige ninguna: se devuelve 'mixta', que es la verdad. Forzarla a una
// sola es exactamente el error que esta regla vino a evitar.
export function familiaDe(ticker) {
  const familias = new Set(metalesDe(ticker).map((m) => FAMILIA[m]))
  if (!familias.size) return null
  if (familias.size > 1) return 'mixta'
  return [...familias][0]
}

const mediana = (nums) => {
  const xs = nums.filter((n) => n != null).sort((a, b) => a - b)
  if (!xs.length) return null
  const m = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2
}

// ¿El día está partido? `retornos` es un Map/objeto ticker → % de la rueda.
// Se pide un mínimo de tres acciones por familia: con dos, la mediana es el
// promedio de dos números y cualquier caso raro la da vuelta.
//
// El corte de 0.5 puntos no es un umbral de significancia, es el ancho del
// redondeo con el que la BVL publica a estos precios: por debajo de eso las
// dos familias están empatadas y llamarlo «partido» sería inventar una
// historia sobre el ruido.
export const MINIMO_POR_FAMILIA = 3
const SEPARACION_MINIMA = 0.5

export function diaPartido(retornos) {
  const pares = retornos instanceof Map ? [...retornos] : Object.entries(retornos || {})
  const grupos = { precioso: [], industrial: [] }
  for (const [ticker, ret] of pares) {
    if (ret == null) continue
    const f = familiaDe(ticker)
    if (f === 'precioso' || f === 'industrial') grupos[f].push(ret)
  }
  const preciosos = grupos.precioso.length >= MINIMO_POR_FAMILIA ? mediana(grupos.precioso) : null
  const industriales = grupos.industrial.length >= MINIMO_POR_FAMILIA ? mediana(grupos.industrial) : null
  if (preciosos == null || industriales == null) {
    return { partido: false, preciosos, industriales, cuantos: { precioso: grupos.precioso.length, industrial: grupos.industrial.length } }
  }
  const partido = Math.sign(preciosos) !== Math.sign(industriales)
    && Math.abs(preciosos - industriales) >= SEPARACION_MINIMA
  return {
    partido,
    preciosos,
    industriales,
    manda: partido ? (preciosos > industriales ? 'precioso' : 'industrial') : null,
    cuantos: { precioso: grupos.precioso.length, industrial: grupos.industrial.length },
  }
}

// ── 2. LA NOTICIA QUE LLEGÓ CON LA RUEDA CERRADA ─────────────────────────
//
// Un Hecho de Importancia presentado a las 20:19 no lo pudo pagar nadie ese
// día: la BVL ya había cerrado. Lo paga la rueda siguiente. Esa ventana es la
// única cosa del Radar que se sabe ANTES de que el precio se mueva, y no
// necesita ninguna fuente nueva — la hora ya viene en el dato:
//
//   · el Hecho VIVO trae `hora` (lib/vivo.js lo baja del endpoint cada 45 s);
//   · el HORNEADO la trae escondida en la ruta del PDF, que la BVL arma con el
//     sello de tiempo de la presentación:
//        …/hhii/B20010/20260805201901/HI32EARNINGS32RELEASE…PDF
//                      └── 2026-08-05 20:19:01
//
// Se lee la del vivo primero y la del PDF como respaldo. Sin ninguna de las
// dos no se marca nada: un Hecho sin hora no dice si entró en rueda o no, y
// suponerlo sería inventar el dato que hace toda la diferencia.
export const CIERRE_BVL = '15:00' // fin de la sesión de negociación

const HORA_EN_PDF = /\/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\//

export function horaDelHecho(hecho) {
  if (!hecho) return null
  if (/^\d{1,2}:\d{2}/.test(hecho.hora || '')) return hecho.hora.slice(0, 5).padStart(5, '0')
  const m = HORA_EN_PDF.exec(hecho.pdf || '')
  if (!m) return null
  const [, a, mes, dia, hh, mm] = m
  // El sello del PDF manda sobre la fecha del listado solo si coinciden: si no,
  // es otro documento y no se le presta la hora a este Hecho.
  if (hecho.fecha && `${a}-${mes}-${dia}` !== hecho.fecha) return null
  return `${hh}:${mm}`
}

// ¿Ese Hecho entró con la rueda abierta o después? `null` cuando no hay hora.
export function fueraDeRueda(hecho) {
  const hora = horaDelHecho(hecho)
  if (!hora) return null
  return { hora, fuera: hora >= CIERRE_BVL }
}

// ¿Ese Hecho todavía no tuvo una rueda donde pagarse? Dos formas de que pase,
// y hacen falta las dos:
//   · salió DESPUÉS de la última rueda cerrada (`fecha > fechaCierre`), a
//     cualquier hora — el mercado ni siquiera abrió desde entonces;
//   · salió el MISMO día del último cierre pero pasadas las 15:00, o sea con
//     esa rueda ya terminada.
// Sin `fechaCierre` se usa la fecha del propio Hecho, que es el caso de quien
// pregunta «¿lo de hoy entró en rueda?».
export function sinPagar(hecho, fechaCierre = null) {
  const r = fueraDeRueda(hecho)
  if (!r) return null
  const posterior = fechaCierre && hecho.fecha > fechaCierre
  if (!posterior && !r.fuera) return null
  if (fechaCierre && hecho.fecha < fechaCierre) return null
  return { fecha: hecho.fecha, hora: r.hora, categoria: hecho.categoria || hecho.titulo || null }
}

// La versión que solo tiene el ticker: abre la puerta de los Hechos y lee el
// más reciente. `hoyISO` es la sesión que se está mirando.
export function noticiaSinPagar(ticker, { vivos = null, hoyISO = null } = {}) {
  const h = hechosDe(ticker, vivos)[0]
  if (!h) return null
  return sinPagar(h, hoyISO)
}

// ── 3. EL TRAMO ESTIRADO (RSI) ───────────────────────────────────────────
//
// RSI de Wilder sobre la MISMA serie que ya usa todo lo demás — no se baja de
// ningún lado. Mide qué proporción del movimiento de las últimas `n` ruedas
// fue hacia arriba. 88 quiere decir que casi no hubo ruedas rojas en el tramo:
// describe el recorrido, no lo que viene después.
//
// Wilder y no la media simple porque es la definición que usa cualquier
// pantalla contra la que Jair vaya a comparar este número (Investing, la mesa
// de su SAB). Un RSI «parecido pero nuestro» sería peor que no tenerlo: se ve
// igual de plausible y no cuadra con nada.
export function rsiDe(valores, n = 14) {
  if (!valores || valores.length < n + 1) return null
  const cierres = valores.map(([, v]) => v)
  let subidas = 0
  let bajadas = 0
  for (let i = 1; i <= n; i++) {
    const d = cierres[i] - cierres[i - 1]
    if (d > 0) subidas += d
    else bajadas -= d
  }
  let mediaSube = subidas / n
  let mediaBaja = bajadas / n
  for (let i = n + 1; i < cierres.length; i++) {
    const d = cierres[i] - cierres[i - 1]
    mediaSube = (mediaSube * (n - 1) + (d > 0 ? d : 0)) / n
    mediaBaja = (mediaBaja * (n - 1) + (d < 0 ? -d : 0)) / n
  }
  if (!mediaBaja) return mediaSube ? 100 : 50
  const rs = mediaSube / mediaBaja
  return 100 - 100 / (1 + rs)
}

// Los cortes clásicos de Wilder. Se dejan en una constante porque son
// convención de mercado, no una decisión nuestra: cambiarlos rompe la
// comparación con cualquier otra pantalla.
export const RSI_ALTO = 70
export const RSI_BAJO = 30

// ── 4. LA MISMA ACCIÓN, DOS BOLSAS ───────────────────────────────────────
//
// Cuatro de las que cotizan en la BVL son emisoras extranjeras y su mercado
// PRINCIPAL está afuera: el precio se hace allá y Lima lo sigue. La lista sale
// de extractor/extranjero_config.json, que ya las tiene fichadas para bajarles
// los estados financieros; acá solo se agrega en qué moneda COTIZA cada plaza,
// que es lo único que aquel archivo no necesitaba (él guarda la moneda en la
// que la empresa REPORTA, que no siempre es la misma).
//
// ESTE ES EL ÚNICO CÁLCULO DEL MÓDULO QUE PIDE UN DATO QUE HOY NO SE BAJA: el
// último precio de la plaza extranjera y el tipo de cambio. Por eso entra por
// argumento y no por import — sin él la función devuelve `null` y el Sonar
// sigue funcionando igual, en vez de mostrar un spread viejo que parece fresco.
export const GEMELAS = {
  RIO: { nombre: 'Rio2 Limited', bolsa: 'TSX (Toronto)', simbolo: 'RIO', moneda: 'CAD' },
  PPX: { nombre: 'PPX Mining Corp.', bolsa: 'TSX-V (Toronto)', simbolo: 'PPX', moneda: 'CAD' },
  PML: { nombre: 'Panoro Minerals Ltd.', bolsa: 'TSX-V (Toronto)', simbolo: 'PML', moneda: 'CAD' },
  AUNA: { nombre: 'Auna S.A.', bolsa: 'NYSE', simbolo: 'AUNA', moneda: 'USD' },
}

export const esGemela = (ticker) => Boolean(GEMELAS[ticker])

// El precio de la plaza extranjera traído a la moneda de Lima y comparado
// contra el de Lima. `fuera` es { precio, moneda, fecha }; `fx` es un mapa de
// pares { 'CAD/USD': 0.7173 } o su inverso { 'USD/CAD': 1.3941 } — se aceptan
// los dos porque las fuentes publican uno u otro y convertir mal el par es la
// forma más fácil de sacar un spread al revés.
export function spreadGemela(ticker, { precioLima, monedaLima, fuera, fx } = {}) {
  const g = GEMELAS[ticker]
  if (!g || !(precioLima > 0) || !(fuera?.precio > 0) || !monedaLima) return null
  const paridad = convertir(fuera.precio, fuera.moneda || g.moneda, monedaLima, fx)
  if (!(paridad > 0)) return null
  return {
    bolsa: g.bolsa,
    precioFuera: fuera.precio,
    monedaFuera: fuera.moneda || g.moneda,
    fecha: fuera.fecha || null,
    paridad,
    monedaLima,
    // Positivo = Lima cotiza MÁS CARA que su propia plaza principal.
    diferenciaPct: ((precioLima - paridad) / paridad) * 100,
  }
}

function convertir(monto, desde, hacia, fx) {
  if (!desde || !hacia) return null
  if (desde === hacia) return monto
  const directo = fx?.[`${desde}/${hacia}`]
  if (directo > 0) return monto * directo
  const inverso = fx?.[`${hacia}/${desde}`]
  if (inverso > 0) return monto / inverso
  return null
}

// ── LAS MARCAS, en el mismo formato que firmaDe() del Radar ──────────────
// id / icono / corto / texto, y cada texto con su número adentro. El Sonar las
// concatena a las que ya arma: no hay una pantalla nueva que mantener.
const pct1 = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`

export function marcasPatron(ticker, { serie = null, dia = null, noticia = null, spread = null } = {}) {
  const marcas = []

  if (dia?.partido) {
    const familia = familiaDe(ticker)
    if (familia) {
      const mia = familia === 'mixta' ? null : dia[familia === 'precioso' ? 'preciosos' : 'industriales']
      const metales = metalesDe(ticker).join(' y ')
      marcas.push({
        id: 'metal',
        icono: '⚖️',
        corto: 'el día lo partió el metal',
        texto: familia === 'mixta'
          ? `Hoy los preciosos hicieron ${pct1(dia.preciosos)} y los industriales ${pct1(dia.industriales)}. Esta vende ${metales}: está en los dos lados de esa raya.`
          : `Hoy los preciosos hicieron ${pct1(dia.preciosos)} y los industriales ${pct1(dia.industriales)} — el día está partido en dos. Esta vende ${metales}, y su mitad del tablero fue ${pct1(mia)}.`,
      })
    }
  }

  if (noticia) {
    marcas.push({
      id: 'sinpagar',
      icono: '🌙',
      corto: `hecho ${noticia.hora}, fuera de rueda`,
      texto: `Presentó un Hecho de Importancia a las ${noticia.hora}, con la rueda ya cerrada (la BVL cierra ${CIERRE_BVL}). Nadie pudo operarlo hoy: lo que diga ese documento se paga en la rueda siguiente.`,
    })
  }

  const rsi = serie ? rsiDe(serie) : null
  if (rsi != null && (rsi >= RSI_ALTO || rsi <= RSI_BAJO)) {
    const alto = rsi >= RSI_ALTO
    marcas.push({
      id: alto ? 'estirada' : 'castigada',
      icono: alto ? '🎈' : '🪨',
      corto: `RSI ${rsi.toFixed(0)}`,
      texto: alto
        ? `RSI de 14 ruedas en ${rsi.toFixed(0)}: casi todo el movimiento de las últimas tres semanas fue hacia arriba, con muy pocas ruedas en contra.`
        : `RSI de 14 ruedas en ${rsi.toFixed(0)}: casi todo el movimiento de las últimas tres semanas fue hacia abajo, con muy pocas ruedas a favor.`,
    })
  }

  if (spread && Math.abs(spread.diferenciaPct) >= 1) {
    const barata = spread.diferenciaPct < 0
    marcas.push({
      id: 'gemela',
      icono: '🔗',
      corto: `${pct1(spread.diferenciaPct)} vs ${spread.bolsa.split(' ')[0]}`,
      texto: `La misma acción cerró en ${spread.monedaFuera} ${spread.precioFuera} en ${spread.bolsa}, que son ${spread.monedaLima} ${spread.paridad.toFixed(3)}. En Lima está ${barata ? 'por debajo' : 'por encima'} de ese precio: ${pct1(spread.diferenciaPct)}.`,
    })
  }

  return marcas
}
