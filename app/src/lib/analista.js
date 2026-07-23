import empresasData from '../data/empresas.json'
import epsAnualData from '../data/eps_anual.json'
import catalizadoresData from '../data/catalizadores.json'
import mineriaData from '../data/mineria.json'
import familiaData from '../data/mineria_familia.json'
import { deudaInfo, lenteDe, esCiclico, aniosTexto, PALABRA_DEUDA } from './lente'
import { peInfo, veredictoPE, dividendosDe } from './finanzas'

// ─────────────────────────────────────────────────────────────────────────
// 🧠 LA LECTURA DE ANALISTA — "nunca un indicador solo" (§5 del plan
// educativo; sesión 3, mejoras #43, #47 y #50).
// La regla de Jair convertida en código: un número aislado no significa nada.
// Aquí se CRUZAN los que ya tenemos (P/E, margen, deuda, FCF, dividendo,
// producción, catalizadores) y solo se escribe la lectura cuando TODOS los
// slots del combo están verificados — mismo patrón que redactor.js: si falta
// un dato, la frase no existe (Regla de Oro #1).
// Nada de esto pide datos nuevos: es cruzar los JSON que ya viajan en la app.
//
// Lo que NO se implementa a propósito: el combo 9 de §5 ("margen que se
// aprieta + costos subiendo") necesita la SERIE de márgenes trimestre a
// trimestre, y hoy solo tenemos el margen del ÚLTIMO trimestre. Inventar la
// tendencia con un solo punto sería exactamente lo que esta app no hace.
// ─────────────────────────────────────────────────────────────────────────

// "US$ 202.5 M" / "S/ -64.9 M" → { v: 202500000, sim: 'US$' }
function parseMonto(s) {
  const m = /(US\$|S\/)\s*(-?[\d,.]+)\s*(MM|M|mil)?/.exec(String(s || ''))
  if (!m) return null
  const v = parseFloat(m[2].replace(/,/g, ''))
  if (!isFinite(v)) return null
  const factor = m[3] === 'MM' ? 1e9 : m[3] === 'M' ? 1e6 : m[3] === 'mil' ? 1e3 : 1
  return { v: v * factor, sim: m[1] }
}

// "84.3% neto · 68.4% bruto" → 84.3
function margenNeto(empresa) {
  const m = /(-?[\d.]+)\s*%\s*neto/.exec(String(empresa?.metricas?.margen || ''))
  if (!m) return null
  const v = parseFloat(m[1])
  return isFinite(v) ? v : null
}

function fmtGrande(n, sim) {
  const signo = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${signo}${sim} ${(abs / 1e9).toFixed(2)} MM`
  if (abs >= 1e6) return `${signo}${sim} ${(abs / 1e6).toFixed(1)} M`
  if (abs >= 1e3) return `${signo}${sim} ${(abs / 1e3).toFixed(1)} mil`
  return `${signo}${sim} ${abs.toFixed(2)}`
}

// ── El margen "típico" de su sector, calculado con las demás empresas de la
// app (mediana, para que un caso raro no lo mueva). Sirve para decir si un
// margen está ALTO *comparado con sus pares*, en vez de con un número mágico.
const medianaCache = {}
function medianaMargenSector(sector) {
  if (sector in medianaCache) return medianaCache[sector]
  const valores = empresasData.empresas
    .filter((x) => x.sector === sector)
    .map(margenNeto)
    .filter((v) => v != null)
    .sort((a, b) => a - b)
  const n = valores.length
  // Con menos de 4 pares la "mediana del sector" es una anécdota, no un dato.
  const med = n >= 4
    ? (n % 2 ? valores[(n - 1) / 2] : (valores[n / 2 - 1] + valores[n / 2]) / 2)
    : null
  medianaCache[sector] = med
  return med
}

// ── Nº de acciones derivado del XBRL (utilidad neta ÷ EPS del trimestre).
// MISMA validación que usa Valoracion.jsx: en holdings y en empresas con
// varias clases de acción ese EPS sale distorsionado, así que se contrasta
// con el EPS anual confiable; si difieren mucho, devolvemos null y el combo
// que dependa de esto sencillamente no se escribe.
function accionesDe(empresa) {
  const r = empresa.evEbitdaRaw
  const ea = epsAnualData.eps?.[empresa.ticker]
  if (!r?.eps || r.utilidadNeta == null || !ea?.epsAnual) return null
  const fx = epsAnualData.tipoCambioUSDPEN
  const mEst = empresa.monedaEstados
  let epsRawAnual = r.eps * 4
  if (mEst !== ea.moneda) {
    if (!fx) return null
    if (mEst === 'USD' && ea.moneda === 'PEN') epsRawAnual *= fx
    else if (mEst === 'PEN' && ea.moneda === 'USD') epsRawAnual /= fx
    else return null
  }
  const ratio = Math.abs(epsRawAnual) / Math.abs(ea.epsAnual)
  if (!(ratio >= 0.25 && ratio <= 4)) return null
  return r.utilidadNeta / r.eps
}

// ─────────────────────────────────────────────────────────────────────────
// 💸 ¿SE PUEDE PAGAR EL DIVIDENDO QUE PAGA? (mejora #47, combo 3 de §5)
// El más valioso para el público dividendero: un yield alto sostenido con
// deuda o con caja vieja no es un yield, es una liquidación en cuotas.
// Se compara lo que REPARTE al año (dividendos.json, por acción × acciones)
// contra su FLUJO DE CAJA LIBRE anualizado (metricas.fcf del XBRL × 4).
// Devuelve null si falta cualquier pieza, o:
//   { noAplica:true, lente }              · banco/seguro/AFP/fondo
//   { estado, ratio, pagado, fcf, sim }   · estado: holgado|justo|forzado|fcfNegativo
// ─────────────────────────────────────────────────────────────────────────
export function sostenibilidadDividendo(empresa) {
  const dv = dividendosDe(empresa.ticker)
  if (!dv?.anualNum || dv.anualNum <= 0) return null

  // En un banco o una aseguradora el "flujo de caja libre" no significa lo
  // mismo (su negocio ES mover plata): el ratio saldría absurdo. Se dice.
  const l = lenteDe(empresa)
  if (l?.deudaAplica === false) return { noAplica: true, lente: l }

  const acciones = accionesDe(empresa)
  if (!acciones) return null
  const f = parseMonto(empresa.metricas?.fcf)
  if (!f) return null

  const fx = epsAnualData.tipoCambioUSDPEN
  const mEst = empresa.monedaEstados
  const sim = mEst === 'USD' ? 'US$' : 'S/'
  // El FCF viene en la moneda de los estados; el dividendo, en la suya.
  const dvMoneda = dv.anualSim === 'US$' ? 'USD' : 'PEN'
  let porAccion = dv.anualNum
  if (dvMoneda !== mEst) {
    if (!fx) return null
    if (dvMoneda === 'USD' && mEst === 'PEN') porAccion *= fx
    else if (dvMoneda === 'PEN' && mEst === 'USD') porAccion /= fx
    else return null
  }

  const pagado = porAccion * acciones
  const fcf = f.v * 4  // el trimestre presentado, anualizado (igual que la deuda)
  if (pagado <= 0) return null

  if (fcf <= 0) return { estado: 'fcfNegativo', pagado, fcf, sim, ratio: null }
  const ratio = pagado / fcf
  // Zonas anchas a propósito: el FCF es de UN trimestre × 4 y los dividendos
  // no se pagan parejos durante el año. Un 0.95 y un 1.05 no son mundos
  // distintos, así que en el medio se dice "justo", no un veredicto.
  const estado = ratio <= 0.7 ? 'holgado' : ratio <= 1.1 ? 'justo' : 'forzado'
  return { estado, ratio, pagado, fcf, sim }
}

export const PALABRA_DIVIDENDO = {
  holgado: { corto: 'Se lo puede pagar', tono: 'bien' },
  justo: { corto: 'Va justo', tono: 'neutro' },
  forzado: { corto: 'Reparte más de lo que le entra', tono: 'ojo' },
  fcfNegativo: { corto: 'Paga sin flujo libre', tono: 'ojo' },
}

// ─────────────────────────────────────────────────────────────────────────
// 🌀 EL P/E DEL FONDO DEL CICLO (mejora #50)
// "Si su ganancia se partiera a la mitad, este P/E 9.6 sería 19.2." Una
// resta que vale más que tres párrafos de advertencia — y es la MISMA
// aritmética que ya usa la prueba del ciclo en la tarjeta de deuda, para
// que el usuario reconozca el gesto. No predice nada: solo muestra qué
// significa el número que ya tiene delante si el motor del negocio afloja.
// ─────────────────────────────────────────────────────────────────────────
export function peEstresado(empresa) {
  if (!esCiclico(empresa)) return null
  const info = peInfo(empresa.ticker)
  if (!info || info.perdida || !info.pe) return null
  const l = lenteDe(empresa)
  return { pe: info.pe, peEstres: info.pe * 2, motor: l?.motor || 'el precio de su producto' }
}

// Los metales que de verdad pagan la planilla de una minera peruana. El
// plomo y el molibdeno quedan fuera a propósito: en TODAS las operaciones de
// este dataset son subproductos del zinc y del cobre.
const METALES_PRINCIPALES = ['cobre', 'oro', 'zinc', 'plata', 'estano', 'hierro']

// ── Producción del BEM: ¿el último trimestre disponible viene mejor o peor
// que el mismo trimestre del año pasado? (combo 10 — el adelanto que solo
// ALTO tiene, porque el MINEM publica antes que el informe de resultados).
function tendenciaProduccion(ticker) {
  const fam = familiaData[ticker]
  if (!fam?.entidades?.length) return null
  const meses = mineriaData.meses || []
  if (meses.length < 16) return null

  let mejor = null
  const metales = new Set()
  for (const clave of fam.entidades) {
    const p = mineriaData.entidades?.[clave]?.produccion || {}
    Object.keys(p).forEach((m) => metales.add(m))
  }

  for (const metal of metales) {
    // Solo METALES QUE FACTURAN. El BEM también trae subproductos (arsénico,
    // bismuto, cadmio, molibdeno, plomo) que se mueven muchísimo en % y no
    // mueven casi nada de sus ingresos: sin este filtro, Buenaventura salía
    // titulada por su ARSÉNICO y Cerro Verde por su molibdeno.
    if (!METALES_PRINCIPALES.includes(metal)) continue
    // Serie sumada de la familia (una empresa puede tener varias unidades).
    const serie = meses.map((_, i) => {
      let suma = null
      for (const clave of fam.entidades) {
        const v = mineriaData.entidades?.[clave]?.produccion?.[metal]?.[i]
        if (v != null) suma = (suma || 0) + v
      }
      return suma
    })
    // Los 3 últimos meses con dato y esos MISMOS 3 meses un año antes.
    const fin = serie.length - 1
    const ventana = [fin - 2, fin - 1, fin]
    const previa = ventana.map((i) => i - 12)
    if (previa[0] < 0) continue
    const hoy = ventana.map((i) => serie[i])
    const antes = previa.map((i) => serie[i])
    // Regla del BEM: un mes sin dato NO es un cero (la empresa no entró al
    // top de productores). Si falta cualquiera de los 6, no se compara.
    if (hoy.some((v) => !v) || antes.some((v) => !v)) continue
    const sumaHoy = hoy.reduce((a, b) => a + b, 0)
    const sumaAntes = antes.reduce((a, b) => a + b, 0)
    if (sumaAntes <= 0) continue
    const pct = ((sumaHoy - sumaAntes) / sumaAntes) * 100
    // ¿Cuál es SU metal? El que pesa más no se puede decidir por volumen (no
    // se comparan gramos de oro con toneladas de cobre), pero sí por su PESO
    // EN EL PAÍS: el BEM trae el total nacional de cada metal, así que la
    // participación es un número sin unidades y comparable entre metales.
    const totalPais = ventana.reduce((a, i) => a + (mineriaData.totalesPais?.[metal]?.[i] || 0), 0)
    const peso = totalPais > 0 ? sumaHoy / totalPais : 0
    if (!mejor || peso > mejor.peso) {
      mejor = { metal, pct, peso, desde: meses[ventana[0]], hasta: meses[fin] }
    }
  }
  return mejor
}

const MES_NOMBRE = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function mesTexto(iso) {
  const [a, m] = String(iso || '').split('-')
  return m ? `${MES_NOMBRE[parseInt(m, 10) - 1]} ${a}` : iso
}

const METAL_NOMBRE = {
  cobre: 'cobre', oro: 'oro', zinc: 'zinc', plata: 'plata', plomo: 'plomo',
  hierro: 'hierro', estano: 'estaño', molibdeno: 'molibdeno',
}

// ─────────────────────────────────────────────────────────────────────────
// Los COMBOS que aplican a ESTA empresa (mejora #43).
// Cada uno: { id, icono, titulo, tono, texto, porque }
//   tono: 'ojo' (rojo/ámbar) · 'bien' (verde) · 'neutro' (lección de método)
//   porque: la regla general — lo que el usuario se lleva para otras fichas
// El orden importa: primero lo que puede hacerle perder plata.
// ─────────────────────────────────────────────────────────────────────────
export function combosDe(empresa) {
  if (!empresa) return []
  const t = empresa.ticker
  const l = lenteDe(empresa)
  const combos = []

  const vpe = veredictoPE(t, empresa.sector)
  const info = peInfo(t)
  const deuda = deudaInfo(empresa)
  const ciclico = esCiclico(empresa)
  const dv = dividendosDe(t)

  // ── Combo 1: P/E bajo + margen alto + cíclica = probable pico de ciclo ──
  if (ciclico && vpe?.estado === 'BARATA' && info?.pe) {
    const mn = margenNeto(empresa)
    const med = medianaMargenSector(empresa.sector)
    const margenAlto = mn != null && med != null && mn > med + 8
    combos.push({
      id: 'picoCiclo',
      icono: '🌀',
      titulo: 'Barata + ganando como nunca + cíclica = ojo con el espejismo',
      tono: 'ojo',
      texto:
        `Su P/E de ${info.pe.toFixed(1)} sale por debajo del rango de su sector, o sea "barata". ` +
        (margenAlto
          ? `Pero al mismo tiempo su margen neto es ${mn.toFixed(1)}%, muy por encima del ${med.toFixed(1)}% típico de las demás ${empresa.sector} de la app. `
          : 'Pero es un negocio que vive de un precio que sube y baja. ') +
        `Y aquí manda ${l?.queManda || 'el precio de su producto'}: cuando ese precio está alto, la ganancia se infla, ` +
        `el P/E se desploma solo y la acción PARECE una ganga justo en el momento más caro del ciclo. ` +
        `La cuenta honesta: si su ganancia volviera a la mitad, ese P/E de ${info.pe.toFixed(1)} pasaría a ${(info.pe * 2).toFixed(1)} — ` +
        'sin que la acción se moviera un centavo.',
      porque: 'En una cíclica, un P/E bajo con márgenes de récord suele ser señal de PICO, no de ganga. El P/E de una cíclica se juzga imaginando su producto barato.',
    })
  }

  // ── Combo 2: P/E bajo + precio viejo = no es ganga, es iliquidez ──
  if (info?.referencial && vpe?.estado === 'BARATA') {
    combos.push({
      id: 'peIliquido',
      icono: '🕸',
      titulo: 'Barata en el papel, pero casi nadie la negocia',
      tono: 'ojo',
      texto:
        `El P/E de ${info.pe.toFixed(1)} se calcula con un precio que no es de hoy: esta acción pasa días o semanas sin negociarse. ` +
        'Un precio viejo hace que el P/E salga bajo sin que nadie haya decidido nada. Y hay un segundo problema, más caro: ' +
        'si compras, para vender necesitas que alguien esté del otro lado — en una acción así, salir puede tomarte semanas o costarte un descuento.',
      porque: 'Barata + ilíquida no es oportunidad: es que el mercado no le ha puesto precio. La liquidez no se ve en el precio, se sufre al vender.',
    })
  }

  // ── Combo 3: yield vs FCF (mejora #47, el más valioso del público de ALTO) ──
  const sd = sostenibilidadDividendo(empresa)
  if (sd && !sd.noAplica) {
    const y = dv?.yield ? ` (rinde ${dv.yield})` : ''
    if (sd.estado === 'forzado' || sd.estado === 'fcfNegativo') {
      combos.push({
        id: 'dividendoForzado',
        icono: '💸',
        titulo: 'Reparte más plata de la que le está entrando',
        tono: 'ojo',
        texto: sd.estado === 'fcfNegativo'
          ? `Este año repartió unos ${fmtGrande(sd.pagado, sd.sim)} en dividendos${y}, pero su flujo de caja libre del último trimestre presentado ` +
            `fue NEGATIVO (${fmtGrande(sd.fcf, sd.sim)} anualizado): después de operar e invertir no le sobró caja. ` +
            'Ese dividendo salió de otro lado — caja acumulada, venta de algo o deuda — y esa es exactamente la pregunta que hay que hacerle.'
          : `Este año repartió unos ${fmtGrande(sd.pagado, sd.sim)} en dividendos${y}, frente a ${fmtGrande(sd.fcf, sd.sim)} de flujo de caja libre anualizado: ` +
            `está entregando alrededor de ${sd.ratio > 3 ? 'más del triple de' : `${sd.ratio.toFixed(1)} veces`} lo que su caja genera. ` +
            'La diferencia sale de la caja que ya tenía, de vender activos o de deuda. Ninguna de las tres dura para siempre.',
        porque: 'Un yield solo se sostiene si el dividendo cabe en el flujo de caja libre. Yield alto + caja corta = recorte futuro, y el recorte suele venir con caída de precio.',
      })
    } else if (sd.estado === 'holgado') {
      combos.push({
        id: 'dividendoHolgado',
        icono: '💚',
        titulo: 'El dividendo le cabe en la caja',
        tono: 'bien',
        texto:
          `Repartió unos ${fmtGrande(sd.pagado, sd.sim)}${y} y su flujo de caja libre anualizado es ${fmtGrande(sd.fcf, sd.sim)}: ` +
          `el dividendo se lleva cerca del ${Math.round(sd.ratio * 100)}% de lo que le sobra después de operar e invertir. ` +
          'Eso no garantiza que lo repita — ninguna empresa está obligada — pero sí que hoy no necesita endeudarse para pagarlo.',
        porque: 'La pregunta correcta ante un dividendo nunca es "¿cuánto paga?" sino "¿de dónde sale?". Si sale del flujo libre, puede repetirse.',
      })
    } else {
      combos.push({
        id: 'dividendoJusto',
        icono: '⚖️',
        titulo: 'El dividendo va justo con su caja',
        tono: 'neutro',
        texto:
          `Repartió unos ${fmtGrande(sd.pagado, sd.sim)}${y} contra ${fmtGrande(sd.fcf, sd.sim)} de flujo de caja libre anualizado: ` +
          'prácticamente todo lo que le sobra se va en dividendo. No es alarma, pero significa que casi no le queda margen para invertir o para un año flojo sin tocar la deuda.',
        porque: 'Repartir el 100% de la caja libre deja a la empresa sin colchón: cualquier tropiezo se paga con deuda o con recorte del dividendo.',
      })
    }
  } else if (sd?.noAplica) {
    combos.push({
      id: 'dividendoNoAplica',
      icono: '🏦',
      titulo: 'Aquí el dividendo no se juzga con el flujo de caja libre',
      tono: 'neutro',
      texto:
        `En ${sd.lente.nombre.toLowerCase()} el "flujo de caja libre" no significa lo mismo que en una empresa normal: su negocio ES mover dinero, ` +
        'así que ese número salta de positivo a negativo según cuánto prestó o captó en el trimestre. Su dividendo se juzga con el capital regulatorio y con el payout sobre utilidades.',
      porque: 'Aplicar la métrica equivocada a un banco no da un mal resultado: da un resultado sin sentido. Primero el lente, después el número.',
    })
  }

  // ── Combo 4: yield >20% con un solo pago = extraordinario ──
  const yNum = parseFloat(String(dv?.yield || '').replace('%', ''))
  const anio = new Date().getFullYear()
  const nPagos = dv?.nPorAnio?.[String(anio)] || dv?.nPorAnio?.[String(anio - 1)] || 0
  if (yNum > 20 && nPagos <= 1) {
    combos.push({
      id: 'yieldExtraordinario',
      icono: '🎁',
      titulo: `Ese ${dv.yield} es de UN pago, no de una costumbre`,
      tono: 'ojo',
      texto:
        `El rendimiento sale de un único reparto${dv.anual ? ` de ${dv.anual} por acción` : ''}. ` +
        'Un pago extraordinario (vendió un activo, repartió caja acumulada, hubo una reorganización) se anualiza solo en la calculadora, no en la realidad. ' +
        'Antes de contarlo como renta anual, mira el historial: cuántas veces pagó en los últimos cinco años y de cuánto.',
      porque: 'Un yield gigante casi nunca es un dividendo: es un evento. Anualizarlo es el error más caro del inversionista dividendero.',
    })
  }

  // ── Combos 5, 6 y 7: la misma deuda, tres veredictos distintos ──
  if (deuda?.aplica === false) {
    combos.push({
      id: 'deudaBanco',
      icono: '🏦',
      titulo: 'Su deuda "gigante" no es un problema: es su materia prima',
      tono: 'neutro',
      texto:
        `Si miras su balance vas a ver pasivos enormes y te vas a asustar. En ${l.nombre.toLowerCase()} eso son los DEPÓSITOS y obligaciones con clientes: ` +
        'el insumo con el que trabaja, como la harina para el panadero. Restarle esa "deuda" a su valor no es ser conservador, es no entender el negocio. ' +
        `Lo que sí se le mira: ${(l.queMirarEnSuLugar || []).slice(0, 3).join(' · ') || l.queManda}.`,
      porque: 'Antes de juzgar un número hay que preguntarse si ese número aplica. En bancos, seguros y AFP la deuda no se lee — se cambia de métrica, no de opinión.',
    })
  } else if (deuda?.estado && deuda.anios != null) {
    const p = PALABRA_DEUDA[deuda.estado]
    if (ciclico && deuda.aniosEstres != null) {
      combos.push({
        id: 'deudaCiclica',
        icono: l.icono || '🌀',
        // El título NO dice "metal": este combo también le toca a una
        // cementera, a una pesquera y a una azucarera (lente cíclico).
        titulo: `Su deuda se juzga con ${l.motor} en el suelo, no en el nivel de hoy`,
        tono: deuda.estadoEstres === 'verde' ? 'bien' : 'ojo',
        texto:
          `Debe ${aniosTexto(deuda.anios)} de su ganancia operativa actual — veredicto de hoy: ${p.corto.toLowerCase()}. ` +
          `Pero esa ganancia está calculada con ${l.motor} en su nivel de HOY. Con la ganancia partida a la mitad, la misma deuda pasa a ${aniosTexto(deuda.aniosEstres)}` +
          (deuda.estadoEstres !== deuda.estado
            ? ` y el veredicto cambia a «${PALABRA_DEUDA[deuda.estadoEstres].corto.toLowerCase()}». Ese es el número que importa: la deuda se paga en los años malos, no en los buenos.`
            : ', así que aguantaría igual. Es de las pocas cíclicas cuya deuda no depende del humor del mercado.'),
        porque: 'La deuda de una cíclica se juzga contra la caja del FONDO del ciclo. La misma cifra que hoy es cómoda se vuelve soga cuando su producto cae 30%.',
      })
    } else if (l.flujo !== 'ciclico' && deuda.anios >= 3) {
      // El caso AUNA de libro: 3.6 años asusta en abstracto y es manejable
      // con lente de salud. Por eso no se dispara con el semáforo (que ya
      // dice "cómoda") sino con el número que el usuario ve y le espanta.
      combos.push({
        id: 'deudaEstable',
        icono: l.icono || '🏥',
        titulo: 'Debe bastante en números absolutos, pero su caja es predecible',
        tono: 'neutro',
        texto:
          `Debe ${aniosTexto(deuda.anios)} de su ganancia operativa. Ese número asusta si lo lees suelto — en una minera sería una alarma. ` +
          `Con lente de ${l.nombre.toLowerCase()} es otra conversación: vive de ${l.viveDe}, un ingreso que no se evapora cuando la economía se pone fea, ` +
          'y una deuda así se amortiza en años. Lo que hay que vigilar no es el número, sino dos cosas concretas: que el plan de bajarla se esté cumpliendo, ' +
          'y a qué tasa está esa deuda (si sube la tasa, sube la cuota).' +
          (deuda.manual?.meta ? ` En su caso, el dato a seguir: ${deuda.manual.meta}.` : ''),
        porque: 'Deuda alta + flujo estable = manejable; deuda alta + flujo cíclico = bomba de tiempo. Es la MISMA deuda y el veredicto es opuesto: lo cambia el lente.',
      })
    }
  }

  // ── Combo 8: FCF negativo + CAPEX alto + proyecto documentado ──
  const fcfM = parseMonto(empresa.metricas?.fcf)
  const capexM = parseMonto(empresa.metricas?.capex)
  if (fcfM && fcfM.v < 0 && capexM && capexM.v > 0) {
    const cats = catalizadoresData.catalizadores?.[t] || []
    // Solo cuenta como "destino de la plata" un catalizador de EXPANSIÓN
    // documentado (una mina, una planta, una ampliación). Un catalizador
    // operativo cualquiera —una negociación de venta, un permiso— no explica
    // en qué se gastó el capex, y darlo por bueno sería inventar el porqué.
    const proyecto = cats.find((c) => c.etiqueta === 'documentado' && c.tipo === 'expansion')
    combos.push({
      id: 'capexProyecto',
      icono: '🏗',
      titulo: proyecto
        ? 'Su caja está en rojo porque está construyendo, no porque se esté hundiendo'
        : 'Su caja está en rojo y no vemos el proyecto que lo explique',
      tono: proyecto ? 'neutro' : 'ojo',
      texto:
        `Su flujo de caja libre del último trimestre presentado es ${fmtGrande(fcfM.v, fcfM.sim)}: gastó más de lo que le entró. ` +
        `La razón está al lado: invirtió ${fmtGrande(capexM.v, capexM.sim)} en el mismo periodo. ` +
        (proyecto
          ? `Y hay un destino documentado para esa plata: ${proyecto.texto} ` +
            'Una empresa que invierte fuerte tiene la caja en rojo por elección, y eso se juzga distinto de una que la tiene en rojo porque el negocio no da. ' +
            'La pregunta correcta pasa a ser: ¿cuándo empieza a producir y con qué se está financiando?'
          : 'Con lo que tenemos publicado no podemos decirte en qué proyecto va esa inversión. Eso no la condena — pero mientras no aparezca el destino, ' +
            'lo honesto es tratarlo como una pregunta abierta: ¿es una mina/planta en construcción o es mantener el negocio a flote?'),
      porque: 'Un FCF negativo no es una enfermedad por sí solo: con un proyecto documentado detrás es inversión; sin él, es una pregunta sin responder.',
    })
  }

  // ── Combo 10: producción subiendo = ingresos del trimestre que viene, hoy ──
  const prod = tendenciaProduccion(t)
  if (prod && Math.abs(prod.pct) >= 8) {
    const sube = prod.pct > 0
    combos.push({
      id: 'produccionAdelanto',
      icono: '⛏️',
      titulo: sube
        ? `Está sacando ${prod.pct.toFixed(0)}% más ${METAL_NOMBRE[prod.metal] || prod.metal} que hace un año`
        : `Está sacando ${Math.abs(prod.pct).toFixed(0)}% menos ${METAL_NOMBRE[prod.metal] || prod.metal} que hace un año`,
      tono: sube ? 'bien' : 'ojo',
      texto:
        `Entre ${mesTexto(prod.desde)} y ${mesTexto(prod.hasta)} produjo ${sube ? '+' : ''}${prod.pct.toFixed(1)}% frente a esos mismos meses del año anterior ` +
        '(boletín del MINEM, dato oficial mes a mes). Esto es un ADELANTO: el informe de resultados de ese trimestre todavía no sale, pero los kilos ya se ' +
        `movieron, y los ingresos de una minera son, en esencia, kilos × precio del metal. ${sube
          ? 'Si el precio del metal no cayó en el mismo periodo, sus ingresos del próximo reporte deberían venir mejores.'
          : 'Si el precio del metal no subió para compensar, sus ingresos del próximo reporte deberían venir más flojos.'}`,
      porque: 'La producción es el único dato de una minera que se conoce ANTES de sus resultados. Producción × precio del metal es el 90% de su ingreso: mirarlos juntos es adelantarse al informe.',
    })
  }

  return combos
}
