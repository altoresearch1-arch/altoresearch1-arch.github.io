import { useEffect, useState } from 'react'
import empresasData from '../data/empresas.json'
import preciosData from '../data/precios.json'
import dividendosData from '../data/dividendos.json'
import hechosData from '../data/hechos.json'
import lecturasData from '../data/lecturas.json'
import epsAnualData from '../data/eps_anual.json'

// ─────────────────────────────────────────────────────────────────────────
// 📓 MI CUADERNO — el estado y la matemática de la cartera del usuario.
//
// Todo vive en SU navegador (localStorage): sin cuentas, sin nube, sin
// backend — la misma filosofía de Sentinel ("tu documento nunca sale de tu
// equipo"). Los datos de mercado (precio, dividendos, hechos, TC) son los
// REALES de los robots; lo único que pone el usuario es cuántas acciones
// tiene y a qué precio las compró.
//
// Regla de Oro #1: sin dato no se inventa. Una empresa sin precio reciente
// se valoriza al costo del usuario (y se dice); un valor fuera de ALTO se
// guarda sin métricas ("solo lo guardamos por ti").
// ─────────────────────────────────────────────────────────────────────────

const LS = {
  visita: 'alto-cuaderno-ultima-visita',
  cuadernos: 'alto-cuadernos',        // índice: [{id, nombre, color}] (máx 3)
  activo: 'alto-cuaderno-activo',      // id del cuaderno abierto
}
const EVENTO = 'alto-cuaderno-cambio'

function lee(k, defecto) {
  try { return JSON.parse(localStorage.getItem(k)) ?? defecto } catch { return defecto }
}
function pon(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* incógnito */ }
  window.dispatchEvent(new CustomEvent(EVENTO))
}

// ── Varios cuadernos (pedido de Jair: hasta 3, con nombre y color) ─────────
// El cuaderno 'principal' usa las claves de SIEMPRE (sin sufijo) → los datos
// actuales del usuario NO se migran ni se pierden. Los cuadernos extra guardan
// bajo claves con su id.
export const MAX_CUADERNOS = 3
export const COLOR_DEFECTO = '#d4af37'
// `filtro`: receta para recolorear el LOGO (imagen JPG) al color del cuaderno,
// misma técnica que el tema por nivel (grayscale→sepia→hue-rotate→saturate):
// así el logo de ALTO sigue el color del cuaderno activo, no el del nivel
// (pedido de Jair). Dorado = color nativo del logo → sin filtro.
export const COLORES_CUADERNO = [
  { nombre: 'Dorado', hex: '#d4af37', filtro: 'none' },
  { nombre: 'Esmeralda', hex: '#4f9d6b', filtro: 'grayscale(1) sepia(1) saturate(2.4) hue-rotate(96deg) brightness(1.02)' },
  { nombre: 'Turquesa', hex: '#46b3a3', filtro: 'grayscale(1) sepia(1) saturate(2.2) hue-rotate(128deg) brightness(1.06)' },
  { nombre: 'Zafiro', hex: '#6b8fc9', filtro: 'grayscale(1) sepia(1) saturate(2) hue-rotate(178deg) brightness(1.1)' },
  { nombre: 'Amatista', hex: '#9a7bb8', filtro: 'grayscale(1) sepia(1) saturate(1.9) hue-rotate(228deg) brightness(1.08)' },
  { nombre: 'Coral', hex: '#d9836f', filtro: 'grayscale(1) sepia(1) saturate(2.6) hue-rotate(-38deg) brightness(1.06)' },
  { nombre: 'Rubí', hex: '#c0563f', filtro: 'grayscale(1) sepia(1) saturate(3.8) hue-rotate(-44deg) brightness(0.94)' },
]

function claves(id) {
  const suf = (!id || id === 'principal') ? '' : '-' + id
  return {
    cartera: 'alto-cuaderno-cartera' + suf,
    notas: 'alto-cuaderno-notas' + suf,
    recs: 'alto-cuaderno-recordatorios' + suf,
  }
}

export function leerCuadernos() {
  const list = lee(LS.cuadernos, null)
  if (Array.isArray(list) && list.length) return list.slice(0, MAX_CUADERNOS)
  return [{ id: 'principal', nombre: 'Mi Cuaderno', color: COLOR_DEFECTO }]
}
export function guardarCuadernos(list) { pon(LS.cuadernos, list.slice(0, MAX_CUADERNOS)) }
export function leerActivo() {
  const id = lee(LS.activo, null)
  const cuadernos = leerCuadernos()
  return cuadernos.some((c) => c.id === id) ? id : cuadernos[0].id
}
export function guardarActivo(id) { pon(LS.activo, id) }
export function borrarDatosCuaderno(id) {
  const k = claves(id)
  try {
    localStorage.removeItem(k.cartera)
    localStorage.removeItem(k.notas)
    localStorage.removeItem(k.recs)
  } catch { /* incógnito */ }
  window.dispatchEvent(new CustomEvent(EVENTO))
}

export function leerCartera(id) {
  const c = lee(claves(id).cartera, [])
  return Array.isArray(c) ? c : []
}
export function guardarCartera(c, id) { pon(claves(id).cartera, c) }
export function leerNotas(id) { return lee(claves(id).notas, {}) || {} }
export function guardarNotas(n, id) { pon(claves(id).notas, n) }
export function leerRecordatorios(id) {
  const r = lee(claves(id).recs, [])
  return Array.isArray(r) ? r : []
}
export function guardarRecordatorios(r, id) { pon(claves(id).recs, r) }

// Hook: cualquier vista (la página, la portada del inicio) se entera al toque.
export function useCartera() {
  const [cartera, setCartera] = useState(() => leerCartera(leerActivo()))
  useEffect(() => {
    const al = () => setCartera(leerCartera(leerActivo()))
    window.addEventListener(EVENTO, al)
    window.addEventListener('storage', al)
    return () => {
      window.removeEventListener(EVENTO, al)
      window.removeEventListener('storage', al)
    }
  }, [])
  return cartera
}

// ── Moneda y formato ──────────────────────────────────────────────────────
export const TC = epsAnualData.tipoCambioUSDPEN || 3.75
export const esUSD = (m) => String(m || '').indexOf('US') === 0
export const enSoles = (monto, moneda) => (esUSD(moneda) ? monto * TC : monto)
export const fmtS = (n) => 'S/ ' + Math.round(n).toLocaleString('es-PE')
export const fmtUSD = (n) => 'US$ ' + Math.round(n).toLocaleString('es-PE')
export const aUSD = (soles) => soles / TC
// Monto en soles mostrado en AMBAS monedas (pedido de Jair: soles y dólares)
export const fmtSyD = (soles) => `${fmtS(soles)} · ${fmtUSD(soles / TC)}`
export const fmtP = (n, mon) => {
  const v = Number(n)
  const pref = esUSD(mon) ? 'US$ ' : 'S/ '
  // Acciones normales: 2 decimales de siempre.
  if (!(Math.abs(v) < 1)) return pref + v.toFixed(2)
  // Acciones/dividendos de centavos (PPX ~0.16): con 2 decimales el precio
  // «no concuerda» con el % del día ni con las acciones que comprarías (ambos
  // se calculan con el precio EXACTO, no con el redondeado). Damos hasta 4
  // decimales recortando ceros sobrantes: 0.1580→0.158, 0.1600→0.16, 0.05→0.05.
  const [ent, frac = ''] = v.toFixed(4).replace(/0+$/, '').split('.')
  return pref + ent + '.' + frac.padEnd(2, '0')
}
// Precio de bolsa EXACTO como lo muestra la ficha de ALTO (valor crudo de
// precios.json, sin redondear): así el Cuaderno y la ficha NUNCA discrepan
// (pedido de Jair: mismo robot, mismo precio en los dos lados).
export const fmtPrecioExacto = (n, mon) => (esUSD(mon) ? 'US$ ' : 'S/ ') + n
export const nombreCorto = (n) => String(n || '')
  .replace(/\s?S\.A\.A\.|\s?S\.A\.|Compañía de Minas\s|Compañía Minera\s|\s?\(Grupo Coril Sociedad Titulizadora\)/g, '')
  .trim()

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MESES_C = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function fechaCorta(f) {
  const d = f instanceof Date ? f : new Date(f + 'T12:00:00')
  return d.getDate() + ' ' + MESES_C[d.getMonth()].toLowerCase()
}
export function haceDias(iso) {
  const dias = Math.floor((Date.now() - new Date(iso + 'T12:00:00')) / 86400000)
  return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : dias < 45 ? `hace ${dias} días` : fechaCorta(iso)
}

// ── La empresa "vista por el cuaderno": precio + dividendos + hechos ─────
// (con el veredicto del lector 🛰 de lecturas.json pegado a cada hecho)
const cacheEmp = {}
export function empresaDe(t) {
  if (cacheEmp[t] !== undefined) return cacheEmp[t]
  const base = empresasData.empresas.find((e) => e.ticker === t)
  if (!base) { cacheEmp[t] = null; return null }
  const px = preciosData.precios?.[t]
  const dv = dividendosData.empresas?.[t]
  const hi = hechosData.hechos?.[t]
  const hechos = (hi?.hechos || []).map((h) => {
    const lec = h.pdf && lecturasData.lecturas?.[h.pdf]
    return lec ? { ...h, veredicto: lec.veredicto, razon: lec.razones?.[0] || null } : h
  })
  cacheEmp[t] = {
    t,
    nombre: base.nombre,
    sector: base.sector,
    precio: px?.precio ?? null,
    previo: px?.previo ?? null,
    moneda: px?.moneda || dv?.anualSim || 'S/',
    fechaPrecio: px?.fecha || null,
    sinNegoc: !!px?.sinNegociacionReciente,
    divMoneda: dv?.anualSim || 'S/',
    yield: dv?.yield || null,
    frecuencia: dv?.frecuencia || null,
    porAnio: dv?.porAnioNum || {},
    historial: dv?.historial || [],
    hechos,
  }
  return cacheEmp[t]
}

// Valores fuera de ALTO (internacionales, nuevos): se guardan sin inventar.
export const stubEmpresa = (c) => ({
  t: c.t,
  nombre: c.nombre || `${c.t} — sin datos ALTO`,
  sector: null,
  precio: c.costo, previo: null, moneda: 'S/', fechaPrecio: null, sinNegoc: false,
  divMoneda: 'S/', yield: null, frecuencia: null,
  porAnio: {}, historial: [], hechos: [], sinDatos: true,
})

// ── Filas calculadas de la cartera (lo que pintan todas las secciones) ───
export function filasDe(cartera) {
  let totalValor = 0, totalCosto = 0, cambioDia = 0, suben = 0, bajan = 0
  const filas = cartera.map((c) => {
    let e = c.manual || c.sinDatos ? stubEmpresa(c) : empresaDe(c.t) || stubEmpresa(c)
    // Empresas ALTO que casi no negocian (AFP, estatales…): sin precio del
    // robot se valoriza al costo del usuario — honesto, sin inventar cotización.
    if (e.precio == null) e = { ...e, precio: c.costo, previo: null, sinPrecio: true }
    const precioSoles = enSoles(e.precio, e.moneda)
    const valor = c.cant * precioSoles
    const costoT = c.cant * enSoles(c.costo, e.moneda)
    totalValor += valor
    totalCosto += costoT
    let dia = 0
    if (e.previo && e.precio !== e.previo) {
      dia = ((e.precio - e.previo) / e.previo) * 100
      cambioDia += c.cant * enSoles(e.precio - e.previo, e.moneda)
      if (dia > 0) suben++; else bajan++
    }
    return {
      ...c, e, precioSoles, valor, costoT,
      gan: c.costo > 0 ? ((e.precio - c.costo) / c.costo) * 100 : 0,
      div12: divUlt12PorAccion(e) * c.cant,          // en soles (para totales/flujo)
      div12nat: divUlt12NativoPorAccion(e) * c.cant, // en la moneda que paga la empresa
      divMoneda: e.divMoneda || e.moneda || 'S/',
      dia,
    }
  })
  const ganTotal = totalCosto > 0 ? ((totalValor - totalCosto) / totalCosto) * 100 : 0
  return { filas, totalValor, totalCosto, ganTotal, cambioDia, suben, bajan }
}

// Dividendos de los últimos 12 meses POR ACCIÓN, en soles (historial real BVL)
export function divUlt12PorAccion(e) {
  if (!e?.historial?.length) return 0
  const hoy = new Date()
  const hace12 = new Date(hoy); hace12.setFullYear(hace12.getFullYear() - 1)
  let s = 0
  for (const h of e.historial) {
    const f = new Date(h.fecha)
    if (f > hace12 && f <= hoy) s += enSoles(h.monto, h.moneda)
  }
  return s
}
export const divUlt12 = (t) => divUlt12PorAccion(empresaDe(t))

// Igual que divUlt12PorAccion pero en la MONEDA que paga la empresa (sin pasar a
// soles) — para mostrar el dividendo tal como lo reparte (US$ o S/). Recuerda:
// varias empresas pagan en dólares (pedido de Jair de mostrarlo así).
export function divUlt12NativoPorAccion(e) {
  if (!e?.historial?.length) return 0
  const hoy = new Date()
  const hace12 = new Date(hoy); hace12.setFullYear(hace12.getFullYear() - 1)
  let s = 0
  for (const h of e.historial) {
    const f = new Date(h.fecha)
    if (f > hace12 && f <= hoy) s += h.monto // en su moneda original (e.divMoneda)
  }
  return s
}

// ── Proyección del flujo: "si repite lo del año pasado" ──────────────────
// Semestrales/anuales: cada pago de los últimos 12 m se proyecta +1 año.
// Mensuales (FIBRAs): promedio de sus pagos, un pago por mes, 7 meses.
// Es un ESTIMADO honesto (patrón histórico), nunca una promesa.
export function proyecciones(filas) {
  const hoy = new Date()
  const hace12 = new Date(hoy); hace12.setFullYear(hace12.getFullYear() - 1)
  const porClave = {}
  for (const c of filas) {
    const e = c.e
    if (!e || e.sinDatos || !e.historial.length) continue
    const monedaEmp = e.divMoneda || 'S/'
    if (e.frecuencia === 'Mensual') {
      const porMes = {}; const porMesNat = {}
      for (const h of e.historial) {
        const f = new Date(h.fecha)
        const k = f.getFullYear() + '-' + f.getMonth()
        porMes[k] = (porMes[k] || 0) + enSoles(h.monto, h.moneda)
        porMesNat[k] = (porMesNat[k] || 0) + h.monto
      }
      const vals = Object.values(porMes)
      if (!vals.length) continue
      const prom = vals.reduce((a, b) => a + b, 0) / vals.length
      const promNat = Object.values(porMesNat).reduce((a, b) => a + b, 0) / vals.length
      const dia = Math.round(e.historial.reduce((a, h) => a + new Date(h.fecha).getDate(), 0) / e.historial.length)
      for (let i = 0; i < 7; i++) {
        const f = new Date(hoy.getFullYear(), hoy.getMonth() + i, dia)
        if (f >= hoy) porClave[c.t + '|' + i] = { t: c.t, fecha: f, soles: prom * c.cant, nativo: promNat * c.cant, moneda: monedaEmp, mensual: true }
      }
      continue
    }
    for (const h of e.historial) {
      const f = new Date(h.fecha)
      if (f <= hace12 || f > hoy) continue
      const fut = new Date(f); fut.setFullYear(fut.getFullYear() + 1)
      const clave = c.t + '|' + fut.toISOString().slice(0, 10)
      if (!porClave[clave]) porClave[clave] = { t: c.t, fecha: fut, soles: 0, nativo: 0, moneda: monedaEmp }
      porClave[clave].soles += enSoles(h.monto, h.moneda) * c.cant
      porClave[clave].nativo += h.monto * c.cant
    }
  }
  return Object.values(porClave).filter((p) => p.fecha >= hoy).sort((a, b) => a.fecha - b.fecha)
}

// Pagos REALES recibidos en los últimos N días (para la línea de tiempo)
export function recibidosRecientes(filas, dias) {
  const hoy = new Date()
  const desde = new Date(hoy - dias * 86400000)
  const lista = []
  for (const f of filas) {
    for (const h of f.e.historial) {
      const fe = new Date(h.fecha)
      if (fe >= desde && fe <= hoy) lista.push({ t: f.t, fecha: fe, soles: enSoles(h.monto, h.moneda) * f.cant })
    }
  }
  return lista.sort((a, b) => b.fecha - a.fecha)
}

// ── Hechos de importancia, en cristiano ──────────────────────────────────
export function catBonita(cat) {
  if (/Derivados/i.test(cat)) return { txt: 'Reporte mensual de derivados', extra: 'rutina — sus tablas asustan pero no son noticia' }
  if (/Utilidades/i.test(cat)) return { txt: '💰 Acuerdo sobre dividendos' }
  if (/Clasificaci/i.test(cat)) return { txt: 'Nota de clasificación de riesgo' }
  if (/Auditoria/i.test(cat)) return { txt: 'Auditoría anual en marcha', extra: 'rutina de todos los años' }
  if (/Junta/i.test(cat)) return { txt: '🏛 Junta de accionistas' }
  if (/Estatutos|Transformaci/i.test(cat)) return { txt: 'Cambio de estatutos' }
  if (/Aprobaci.n De La Informaci.n Financier|Estados Financieros/i.test(cat)) return { txt: '📊 Resultados financieros' }
  if (/Otros Hechos/i.test(cat)) return { txt: 'Comunicado' }
  return { txt: String(cat || 'Hecho de importancia').replace(/\.$/, '') }
}
export function tipoPunto(cat) {
  if (/Junta/i.test(cat)) return 'junta'
  if (/Aprobaci.n De La Informaci.n Financier|Estados Financieros/i.test(cat)) return 'resultados'
  return 'hecho'
}
// ¿Hay un acuerdo de dividendos publicado hace poco? (HI real, categoría
// "Acuerdo sobre aplicación de utilidades")
export function acuerdoDividendo(t) {
  const e = empresaDe(t)
  if (!e) return null
  return e.hechos.find((h) =>
    /Utilidades/i.test(h.categoria) && (Date.now() - new Date(h.fecha + 'T12:00:00')) < 120 * 86400000) || null
}

// ─────────────────────────────────────────────────────────────────────────
// 🛰 EL DICCIONARIO DE TICKERS — sin IA: normalizar → exacto → alias →
// distancia de edición ≤ 2. (ARQUITECTURA_IMPORTACION_CARTERA.md: "OCR
// primero, diccionario después; nunca se le cree el ticker a nadie".)
// ─────────────────────────────────────────────────────────────────────────
// 'Otra' al final = deja escribir tu SAB a mano (SelectorSAB en Cuaderno.jsx).
export const SABS = ['Kallpa SAB', 'BBVA SAB', 'Credicorp Capital', 'Inteligo SAB',
  'Renta4', 'Magot SAB', 'Trii', 'Otra']

export const ALIAS = {
  FERREYCORP: 'FERREYC1', FERREY: 'FERREYC1',
  MINSUR: 'MINSURI1', MINSURSA: 'MINSURI1',
  GLORIA1: 'GLORIAI1', GLORIA: 'GLORIAI1',
  VOLCAN: 'VOLCABC1', VOLCANB: 'VOLCABC1',
  NEXA: 'NEXAPEC1', NEXARESOURCESPERU: 'NEXAPEC1',
  BUENAVENTURA: 'BVN', ENGIE: 'ENGIEC1', ALICORP: 'ALICORC1',
  CERROVERDE: 'CVERDEC1', SOUTHERN: 'SCCO', CREDICORP: 'BAP',
  BROCAL: 'BROCALC1', ELBROCAL: 'BROCALC1', LUZDELSUR: 'LUSURC1',
  UNACEM: 'UNACEMC1', BACKUS: 'BACKUSI1', FIBRAPRIME: 'FIBPRIME',
  INTERCORP: 'IFS', INRETAIL: 'INRETC1', PODEROSA: 'PODERC1',
}
export const INTERNACIONALES = ['AAPL', 'MSFT', 'VOO', 'SPY', 'QQQ', 'NVDA', 'TSLA',
  'AMZN', 'GOOG', 'GOOGL', 'META', 'KO', 'BRKB', 'JNJ', 'V', 'JPM', 'DIS']

export const normTicker = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '')

// Levenshtein acotada a 2 (más de 2 ya no es "error de OCR", es otra palabra)
export function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const m = a.length, n = b.length
  const fila = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = fila[0]
    fila[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return fila[n]
}

const existeTicker = (t) => empresasData.empresas.some((e) => e.ticker === t)

export function buscarTicker(crudo) {
  const q = normTicker(crudo)
  if (!q) return { estado: 'desconocido', crudo }
  if (existeTicker(q)) return { estado: 'exacto', t: q, conf: 100 }
  if (ALIAS[q]) return { estado: 'alias', t: ALIAS[q], conf: 100, crudo }
  if (INTERNACIONALES.includes(q)) return { estado: 'internacional', crudo: q }
  let mejor = null, mejorD = 3
  for (const e of empresasData.empresas) {
    const d = distancia(q, e.ticker)
    if (d < mejorD) { mejorD = d; mejor = e.ticker }
  }
  for (const a of Object.keys(ALIAS)) {
    const d = distancia(q, a)
    if (d < mejorD) { mejorD = d; mejor = ALIAS[a] }
  }
  if (mejor) return { estado: 'corregido', t: mejor, conf: mejorD === 1 ? 95 : 85, crudo }
  return { estado: 'desconocido', crudo }
}

// Cartera de ejemplo (posiciones inventadas sobre empresas REALES): para que
// el que llega sin nada vea al cuaderno vivo antes de anotar lo suyo.
export const CARTERA_DEMO = [
  { t: 'NEXAPEC1', cant: 1200, costo: 3.25, sab: 'Kallpa SAB' },
  { t: 'BVN', cant: 150, costo: 28.4, sab: 'Kallpa SAB' },
  { t: 'MINSURI1', cant: 800, costo: 5.9, sab: 'BBVA SAB' },
  { t: 'FERREYC1', cant: 1500, costo: 3.1, sab: 'Renta4' },
  { t: 'ENGIEC1', cant: 900, costo: 4.2, sab: 'Kallpa SAB' },
  { t: 'VOLCABC1', cant: 5000, costo: 1.05, sab: 'BBVA SAB' },
  { t: 'ALICORC1', cant: 250, costo: 11.1, sab: 'Trii' },
  { t: 'FIBPRIME', cant: 400, costo: 6.8, sab: 'Renta4' },
]

export function leerVisitaAnterior() { return lee(LS.visita, null) }
export function marcarVisita() { try { localStorage.setItem(LS.visita, JSON.stringify(Date.now())) } catch { /* sin storage */ } }
