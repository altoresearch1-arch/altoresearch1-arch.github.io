import cotizacionesData from '../data/cotizaciones.json'
import { claveLente } from './lente'
import { historicoDe, precioEnFecha } from './finanzas'

// ─────────────────────────────────────────────────────────────────────────
// 🛢️🥇 EL PRECIO DEL MOTOR (mejora #116 — pedido de Jair el 22-jul-2026)
// El driver #1 de media BVL faltaba: una minera no vive de sus decisiones,
// vive del precio de su metal. Y lo mismo la pesquera (harina de pescado),
// la azucarera (azúcar) y la refinería (petróleo).
// Los datos son del BCRP (cotizaciones mensuales oficiales, ver
// extractor/fetch_cotizaciones.py). Aquí solo se ORDENAN y se convierten en
// las tres preguntas que importan:
//   1. ¿cómo estuvo cada año? (¿viene subiendo o bajando?)
//   2. ¿qué hizo ESTE año? (el vaivén de 2026 que Jair describió)
//   3. ¿y eso qué tiene que ver con el precio de la acción?
// ─────────────────────────────────────────────────────────────────────────

// De qué producto vive cada empresa. Los mineros van por TICKER (dos mineras
// del mismo sector pueden vivir de metales distintos) y el resto hereda de su
// lente. Curado a mano contra sus propias minas y memorias — si una empresa no
// está aquí, no se le muestra un precio inventado.
const POR_TICKER = {
  // oro
  BVN: 'oro', PODERC1: 'oro', PPX: 'oro', RIO: 'oro', ANDEXBC1: 'oro',
  // cobre
  CVERDEC1: 'cobre', SPCCPI1: 'cobre', SCCO: 'cobre', BROCALC1: 'cobre',
  // zinc
  NEXAPEC1: 'zinc', VOLCABC1: 'zinc', ATACOBC1: 'zinc', LUISAI1: 'zinc',
  MOROCOI1: 'zinc', PERUBAI1: 'zinc',
  // plata
  MINCORI1: 'plata',
  // estaño
  MINSURI1: 'estano',
  // Shougang (hierro) queda fuera a propósito: el BCRP no publica el hierro y
  // preferimos no mostrarle el precio de otro metal.
}

const POR_LENTE = {
  hidrocarburos: 'petroleo',
  pesqueras: 'harina',
  agro: 'azucar',
}

// El nombre con su artículo, para que las frases no salgan en robot ("el
// precio del harina de pescado"). Se escribe aquí y no en el JSON porque es
// castellano, no dato.
const CON_ARTICULO = {
  cobre: 'del cobre', oro: 'del oro', plata: 'de la plata', zinc: 'del zinc',
  plomo: 'del plomo', estano: 'del estaño', petroleo: 'del petróleo',
  harina: 'de la harina de pescado', azucar: 'del azúcar', trigo: 'del trigo',
  maiz: 'del maíz', soya: 'del aceite de soya',
}

// La frase "una minera con la misma mina, la misma gente y el mismo plan" es
// la que hace entender el vaivén… pero solo si la empresa ES una minera. En
// Petroperú salía hablando de minas (bug visto en el deploy del 23-jul). Aquí
// cada lente pone su propia versión de "la misma empresa de siempre".
const MISMA_CASA = {
  minas: 'una minera con la misma mina, la misma gente y el mismo plan',
  hidrocarburos: 'una refinería con la misma planta, la misma gente y el mismo plan',
  pesqueras: 'una pesquera con la misma flota, la misma gente y la misma cuota',
  agro: 'una azucarera con el mismo campo, la misma gente y la misma zafra',
}
const MISMA_CASA_GENERICA = 'una empresa con los mismos activos, la misma gente y el mismo plan'

// ¿Qué papel juega ese precio en la empresa? En una minera o una azucarera es
// su INGRESO (vende eso). En una refinería el crudo entra por los dos lados:
// es su materia prima Y la referencia de lo que vende, así que lo suyo es la
// DIFERENCIA entre ambos — un petróleo caro no es automáticamente bueno para
// ella. Decir esto es la mitad de la lección.
const ROL_POR_LENTE = { hidrocarburos: 'ambos' }

export function productoDe(empresa) {
  if (!empresa) return null
  const lente = claveLente(empresa)
  const clave = POR_TICKER[empresa.ticker] || POR_LENTE[lente]
  const p = clave ? cotizacionesData.productos?.[clave] : null
  if (!p) return null
  return {
    clave,
    rol: ROL_POR_LENTE[lente] || 'ingreso',
    conArticulo: CON_ARTICULO[clave] || `de ${p.nombre.toLowerCase()}`,
    mismaCasa: MISMA_CASA[lente] || MISMA_CASA_GENERICA,
    ...p,
  }
}

export const fuenteCotizaciones = {
  fuente: cotizacionesData.fuente,
  url: cotizacionesData.fuenteUrl,
  actualizado: cotizacionesData.actualizado,
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
export function mesCorto(iso) {
  const [a, m] = String(iso || '').split('-')
  return m ? `${MESES_CORTOS[parseInt(m, 10) - 1]} ${a}` : iso
}

// ── 1. Año por año: el promedio de cada año y cuánto cambió contra el previo.
// Devuelve además la RACHA (cuántos años seguidos viene subiendo), que es la
// forma en que Jair lo cuenta: "y fueron subiendo cada año".
export function porAnio(prod, cuantos = 8) {
  if (!prod?.anual) return []
  const anios = Object.keys(prod.anual).sort().slice(-cuantos)
  return anios.map((a, i) => {
    const previo = i > 0 ? prod.anual[anios[i - 1]] : null
    return {
      anio: a,
      valor: prod.anual[a],
      cambio: previo ? ((prod.anual[a] - previo) / previo) * 100 : null,
      parcial: a === prod.anioParcial,
    }
  })
}

// Años CERRADOS seguidos al alza. El año en curso no cuenta como año (todavía
// no terminó), pero se dice aparte si también va arriba.
export function racha(prod) {
  const filas = porAnio(prod, 20).filter((f) => f.cambio != null && !f.parcial)
  let n = 0
  for (let i = filas.length - 1; i >= 0; i--) {
    if (filas[i].cambio > 0) n++
    else break
  }
  const enCurso = porAnio(prod, 20).find((f) => f.parcial)
  return { anios: n, enCursoSube: enCurso?.cambio != null && enCurso.cambio > 0 }
}

// ── 2. Lo que hizo ESTE año: de dónde salió, a dónde llegó, y el vaivén entre
// su mes más alto y su mes más bajo (que casi siempre es mucho mayor que la
// diferencia punta a punta — la lección de que el promedio esconde el viaje).
export function esteAnio(prod) {
  if (!prod?.mensual?.length || !prod.anioParcial) return null
  const meses = prod.mensual.filter(([iso]) => iso.startsWith(prod.anioParcial))
  if (meses.length < 2) return null
  const primero = meses[0]
  const ultimo = meses[meses.length - 1]
  const alto = prod.maxDelAnio
  const bajo = prod.minDelAnio
  return {
    meses,
    primero: { mes: primero[0], valor: primero[1] },
    ultimo: { mes: ultimo[0], valor: ultimo[1] },
    cambio: ((ultimo[1] - primero[1]) / primero[1]) * 100,
    alto,
    bajo,
    vaiven: ((alto.valor - bajo.valor) / bajo.valor) * 100,
    // ¿el punto más alto vino antes o después del más bajo? (subió y luego
    // cayó, o cayó y luego se recuperó — no es lo mismo para el que compró)
    subioDespues: bajo.mes < alto.mes,
  }
}

// ── 3. El eslabón que faltaba: ¿y la ACCIÓN qué hizo mientras tanto?
// Se comparan los ÚLTIMOS 12 MESES del precio del producto (BCRP) contra el
// precio de la acción en las mismas dos fechas (cierres reales de la BVL, de
// historicos.json). Sin correlaciones ni estadística: dos restas que el
// usuario puede rehacer a mano. Si falta cualquiera de los cuatro datos, no
// se escribe nada (Regla de Oro #1).
export function contraLaAccion(empresa, prod) {
  if (!empresa || !prod?.mensual?.length) return null
  const h = historicoDe(empresa.ticker)
  if (!h?.valores?.length) return null
  if (h.volatilidadEtiqueta === 'poco negociada') return null

  const n = prod.mensual.length
  if (n < 13) return null
  const [mesFin, valFin] = prod.mensual[n - 1]
  const [mesIni, valIni] = prod.mensual[n - 13]
  if (!valIni || !valFin) return null

  // Un mes del BCRP es un PROMEDIO mensual; la acción se compara con su cierre
  // al final de ese mismo mes (último día del mes, o el cierre previo).
  const finMes = (iso) => {
    const [a, m] = iso.split('-').map(Number)
    return `${a}-${String(m).padStart(2, '0')}-${new Date(a, m, 0).getDate()}`
  }
  const pxIni = precioEnFecha(empresa.ticker, finMes(mesIni))
  const pxFin = precioEnFecha(empresa.ticker, finMes(mesFin))
  if (!pxIni || !pxFin || !pxIni.precio) return null

  return {
    desde: mesIni,
    hasta: mesFin,
    producto: ((valFin - valIni) / valIni) * 100,
    accion: ((pxFin.precio - pxIni.precio) / pxIni.precio) * 100,
    precioIni: pxIni,
    precioFin: pxFin,
  }
}

// ── Contexto de ciclo (#53): ¿el precio de hoy está alto o bajo comparado con
// su propio promedio de los últimos 5 años cerrados? Es el insumo que le
// faltaba al combo del pico de ciclo — y no predice nada: describe dónde está.
export function zonaDelCiclo(prod) {
  if (!prod?.promedio5a || !prod.ultimo?.valor) return null
  const pct = ((prod.ultimo.valor - prod.promedio5a) / prod.promedio5a) * 100
  const zona = pct > 20 ? 'alta' : pct < -20 ? 'baja' : 'media'
  return { pct, zona, promedio5a: prod.promedio5a, anios: prod.aniosPromedio5a }
}

// Los precios traen decimales que no aportan (615.72 ¢US$/lb). Se muestran
// como los diría una persona.
export function fmtPrecio(v, unidad) {
  if (v == null) return '—'
  const n = v >= 1000 ? Math.round(v).toLocaleString('es-PE') : v.toFixed(v >= 100 ? 0 : 2)
  return `${n} ${unidad}`
}
