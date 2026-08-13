import historicosData from '../data/historicos.json'
import preciosData from '../data/precios.json'

// ═════════════════════════════════════════════════════════════════════════
// 📈 LA SERIE DE PRECIOS — la ÚNICA puerta para pedirla
//
// POR QUÉ EXISTE ESTE ARCHIVO. `historicos.json` solo se rehace en la corrida
// de cierre de las 22:23, y el cron de GitHub es «mejor esfuerzo» — el
// 03-ago-2026 se saltó 25 turnos programados seguidos. O sea que el archivo se
// queda ruedas atrás CON FRECUENCIA: el 04-ago llegaba al 30-jul mientras el
// precio ya era del 3-ago, tres ruedas de diferencia en las 45 acciones.
//
// El Radar reparaba esa serie antes de calcular. El resto de la app, no. De ahí
// salieron dos bugs con la misma raíz:
//   · el «+X% desde el titular» se medía contra el cierre del 30-jul mientras
//     la misma ficha mostraba el precio del 3-ago (hasta 7 puntos de diferencia);
//   · el Sparkline de la ficha de empresa y del Cuaderno terminaba tres ruedas
//     antes que el «Valor hoy» que tiene una línea más abajo.
//
// Ninguno era un error de cálculo: eran dos fuentes de verdad para el mismo
// dato. Por eso la reparación se muda acá y `historicoDe()` DEJA DE DEVOLVER
// `valores` (lib/finanzas.js). No es una convención que haya que recordar: si
// la serie cruda no sale por ninguna puerta de la UI, no se puede leer mal.
//
// LAS DOS PATAS DE LA REPARACIÓN, y hacen falta las dos:
//   1) `conCola`          — las ruedas CERRADAS que el robot no alcanzó a
//                           guardar, bajadas en vivo de la BVL.
//   2) `conUltimoPrecio`  — la rueda EN CURSO (o el último precio conocido).
// Reparar solo con el precio de hoy y saltarse la cola deja la serie con un
// hueco en el medio, y entonces «dos semanas» sigue midiendo desde una fecha
// vieja: es el bug original con otra ropa.
// ═════════════════════════════════════════════════════════════════════════

const TODOS = historicosData.historicos || {}

export const tickersConHistorico = () => Object.keys(TODOS)
export const totalEnArchivo = () => Object.keys(TODOS).length

// ── Los METADATOS de la acción: volatilidad, rango del año, liquidez, moneda.
// Todo lo del archivo MENOS la serie. Que tres ruedas falten no cambia ninguno
// de estos números, y son los que usan las nueve pantallas que no dibujan
// precios (Termómetro, Explorar, Comparador…).
//
// Se cachea por identidad a propósito: `metaDe(t)` devuelve SIEMPRE el mismo
// objeto para el mismo ticker, así sirve como dependencia de un useMemo sin
// forzar un recálculo en cada repintado.
const cacheMeta = new Map()

export function metaDe(ticker) {
  if (cacheMeta.has(ticker)) return cacheMeta.get(ticker)
  const h = TODOS[ticker]
  let meta = null
  if (h) {
    const { valores, ...resto } = h // eslint-disable-line no-unused-vars
    meta = resto
  }
  cacheMeta.set(ticker, meta)
  return meta
}

// ── La serie CRUDA del archivo, sin reparar. Es para contar ruedas y para
// mirar 18 meses hacia atrás, donde tres ruedas no cambian nada.
// NUNCA para mostrar un precio de hoy ni para medir una ventana que termina
// hoy: para eso está `serieDe()`.
const cacheCruda = new Map()

export function crudaDe(ticker) {
  if (cacheCruda.has(ticker)) return cacheCruda.get(ticker)
  const vals = (TODOS[ticker]?.valores || []).filter(([, v]) => v > 0)
  cacheCruda.set(ticker, vals)
  return vals
}

// ── LAS RUEDAS QUE EL ROBOT NO ALCANZÓ A GUARDAR ─────────────────────────
// Solo se agregan fechas POSTERIORES a la última del archivo: un cierre ya
// guardado no se reescribe nunca.
export function conCola(base, cola) {
  if (!cola?.length || !base.length) return base
  const ultima = base[base.length - 1][0]
  const nuevas = cola
    .filter(([f, v]) => f > ultima && v > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  return nuevas.length ? [...base, ...nuevas] : base
}

// ── EL PRECIO DE HOY, PEGADO AL FINAL DE LA SERIE ────────────────────────
//
// La regla es la fecha de la SESIÓN (la de la última operación, no la de
// nuestra consulta):
//   · sesión POSTERIOR al último cierre -> se agrega una fila: hoy existe.
//   · sesión IGUAL al último cierre     -> se reemplaza: es el mismo día, más
//     fresco.
//   · sesión ANTERIOR (o sin dato)      -> no se toca NADA. Esto es lo que
//     protege de la acción que lleva días sin negociar: la BVL repite su
//     último cierre, y estamparlo como si fuera de hoy inventaría una rueda
//     que no existió (INVARIANTES.md #21).
export function conUltimoPrecio(base, px) {
  const precio = px?.precio
  if (!(precio > 0) || !base.length) return base
  const sesion = (px.ultimaOperacion || '').slice(0, 10) || px.fecha
  if (!sesion) return base
  const ultima = base[base.length - 1][0]
  if (sesion > ultima) return [...base, [sesion, precio]]
  if (sesion === ultima) return [...base.slice(0, -1), [sesion, precio]]
  return base
}

// ── LA PUERTA ────────────────────────────────────────────────────────────
//
// Sin argumentos repara con `precios.json`, que está horneado en el bundle y
// por lo tanto SIEMPRE está disponible, en cualquier módulo y sin red. Eso
// solo ya alcanza para que ninguna pantalla dibuje una serie que termine antes
// que el precio que muestra al lado.
//
// El Radar, que además tiene la cola bajada en vivo y el precio del navegador,
// los pasa explícitos. NINGÚN camino devuelve la serie cruda: un llamador que
// se olvida de un argumento recibe la serie reparada con lo horneado, nunca la
// del archivo a secas.
export function serieDe(ticker, { cola = null, px = null } = {}) {
  const base = conCola(crudaDe(ticker), cola)
  return conUltimoPrecio(base, px || preciosData.precios?.[ticker])
}
