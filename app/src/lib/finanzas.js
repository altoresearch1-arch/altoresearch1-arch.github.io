import preciosData from '../data/precios.json'
import epsAnualData from '../data/eps_anual.json'
import dividendosData from '../data/dividendos.json'
import historicosData from '../data/historicos.json'
import escenariosData from '../data/escenarios.json'

// P/E CON CONTEXTO (pedido de Jair 08-jul): P/E = precio ÷ BPA anual (SMV).
// Antes, si el precio era viejo (acción ilíquida) el P/E se OCULTABA — pero el
// BPA sí existe (ej. Santa Luisa: BPA S/ 41.02, precio S/ 304 → P/E ~7.4).
// Ahora se muestra CON advertencia. Devuelve:
//   { pe, referencial, fechaPrecio }  · referencial=true → precio viejo, ⚠
//   { perdida: true }                 · BPA anual ≤ 0 (no hay P/E)
//   null                              · sin precio o sin BPA anual
export function peInfo(ticker) {
  const px = preciosData.precios?.[ticker]
  const ea = epsAnualData.eps?.[ticker]
  if (!px || px.precio == null || !ea || ea.epsAnual == null) return null
  if (ea.epsAnual <= 0) return { perdida: true }
  const monedaPrecio = px.moneda === 'US$' ? 'USD' : 'PEN'
  let eps = ea.epsAnual
  if (monedaPrecio !== ea.moneda) {
    const fx = epsAnualData.tipoCambioUSDPEN
    if (!fx) return null
    if (ea.moneda === 'USD' && monedaPrecio === 'PEN') eps = eps * fx
    else if (ea.moneda === 'PEN' && monedaPrecio === 'USD') eps = eps / fx
  }
  const pe = px.precio / eps
  if (!isFinite(pe) || pe <= 0) return null
  return { pe, referencial: !!px.sinNegociacionReciente, fechaPrecio: px.fecha || null }
}

export function precioDe(ticker) {
  return preciosData.precios?.[ticker] || null
}

export function dividendosDe(ticker) {
  return dividendosData.empresas?.[ticker] || null
}

export function historicoDe(ticker) {
  return historicosData.historicos?.[ticker] || null
}

export function pagaDividendos(ticker) {
  const dv = dividendosDe(ticker)
  return !!(dv && ((dv.anualNum && dv.anualNum > 0) || dv.porAnio?.['2025'] || dv.porAnio?.['2026']))
}

// Precio de cierre REAL en (o justo antes de) una fecha dada, buscado en el
// histórico BVL (historicos.json, cubre desde enero del año pasado). Devuelve
// { precio, fecha, moneda } con la fecha del cierre usado, o null si no hay
// cierre a menos de 14 días (Regla de Oro #1: sin dato, no se inventa).
export function precioEnFecha(ticker, isoFecha) {
  const h = historicoDe(ticker)
  if (!h?.valores?.length || !isoFecha) return null
  let elegido = null
  for (const [fecha, cierre] of h.valores) {
    if (fecha > isoFecha) break
    elegido = { fecha, precio: cierre }
  }
  if (!elegido) return null
  const dias = (new Date(isoFecha) - new Date(elegido.fecha)) / 86400000
  if (dias > 14) return null
  const px = precioDe(ticker)
  return { ...elegido, moneda: (h.moneda || '').trim() || px?.moneda || '' }
}

// Yield numérico ("3.68%" -> 3.68) para ordenar; null si no hay.
export function yieldNumerico(ticker) {
  const dv = dividendosDe(ticker)
  if (!dv?.yield) return null
  const n = parseFloat(String(dv.yield).replace('%', '').replace(',', '.'))
  return isFinite(n) ? n : null
}

// Variaciones del último cierre vs el previo, para TODAS las empresas que
// negociaron con precio fresco (misma regla que "Así cerró la BVL"): quedan
// fuera las sinNegociacionReciente (su variación sería vieja y engañosa).
// La usan HoyBVL (ranking del día) y CintaBVL (la cinta bursátil del inicio).
export function variacionesDia(empresas) {
  const filas = []
  let subieron = 0, bajaron = 0, planas = 0
  const fechas = {}
  for (const e of empresas) {
    const px = preciosData.precios?.[e.ticker]
    if (!px || px.precio == null || px.previo == null || px.sinNegociacionReciente) continue
    if (px.previo <= 0) continue
    const pct = ((px.precio - px.previo) / px.previo) * 100
    if (pct > 0.001) subieron++
    else if (pct < -0.001) bajaron++
    else planas++
    if (px.fecha) fechas[px.fecha] = (fechas[px.fecha] || 0) + 1
    filas.push({ ticker: e.ticker, nombre: e.nombre, pct, precio: px.precio, moneda: px.moneda })
  }
  filas.sort((a, b) => b.pct - a.pct)
  const fecha = Object.entries(fechas).sort((a, b) => b[1] - a[1])[0]?.[0]
  return { filas, subieron, bajaron, planas, fecha }
}

// Cambio % de los últimos ~6 meses (cierres reales BVL, mismo cálculo que el
// Sparkline: primer vs último cierre del rango). null si no hay serie o si la
// acción es "poco negociada" (el % sería engañoso — la BVL rellena la serie).
export function cambio6M(ticker) {
  const h = historicoDe(ticker)
  if (!h?.valores?.length) return null
  if (h.volatilidadEtiqueta === 'poco negociada') return null
  const corte = new Date()
  corte.setMonth(corte.getMonth() - 6)
  const iso = corte.toISOString().slice(0, 10)
  const rango = h.valores.filter(([f, v]) => f >= iso && v > 0)
  if (rango.length < 2) return null
  const primero = rango[0][1]
  const ultimo = rango[rango.length - 1][1]
  if (!primero) return null
  return ((ultimo - primero) / primero) * 100
}

// Veredicto de valoración por P/E vs el rango justo del sector — el MISMO
// método de Valoracion.jsx (allá está explicado con la fórmula); aquí solo la
// conclusión para la radiografía exprés. Devuelve:
//   { estado: 'BARATA'|'EN RANGO'|'CARA', pe, referencial }
//   { perdida: true }  · tuvo pérdida anual (no hay P/E)
//   null               · sin precio/BPA/rango del sector
export function veredictoPE(ticker, sector) {
  const rango = escenariosData.rangoPE?.[sector]
  if (!rango) return null
  const info = peInfo(ticker)
  if (!info) return null
  if (info.perdida) return { perdida: true }
  let estado = 'EN RANGO'
  if (info.pe < rango.bajo) estado = 'BARATA'
  else if (info.pe > rango.alto) estado = 'CARA'
  return { estado, pe: info.pe, referencial: info.referencial }
}
