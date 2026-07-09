import preciosData from '../data/precios.json'
import epsAnualData from '../data/eps_anual.json'
import dividendosData from '../data/dividendos.json'
import historicosData from '../data/historicos.json'

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
