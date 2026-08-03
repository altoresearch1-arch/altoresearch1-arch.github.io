import empresasData from '../data/empresas.json'
import historicosData from '../data/historicos.json'
import preciosData from '../data/precios.json'
import hechosData from '../data/hechos.json'
import noticiasData from '../data/noticias.json'
import dividendosData from '../data/dividendos.json'
import cotizacionesData from '../data/cotizaciones.json'

// ─────────────────────────────────────────────────────────────────────────
// 📡 RADAR DE ROTACIÓN — qué se está moviendo y si se movió DE VERDAD.
//
// Todo sale de datos que el robot ya baja a diario (historicos.json de la
// BVL): cero fuentes nuevas, cero pasos nuevos en el extractor. La cuenta se
// hace acá en el navegador porque es barata (~32 series × 390 cierres) y así
// el Radar siempre está en sincronía con el último precio que cayó al repo.
//
// LAS DOS REGLAS QUE LO HACEN HONESTO
//
// 1) Solo entran las acciones que SE NEGOCIAN. De las 114 del archivo, 82
//    tienen el precio congelado: la BVL repite el último cierre cuando nadie
//    operó, así que la "subida" que muestran es de un día viejo. Sin este
//    filtro el ranking se llena de fantasmas — GRHOLDC1 aparecía con +674%
//    en 20 días habiendo cambiado de precio 2 veces en el mes (31-jul-2026).
//    El filtro no lo inventamos acá: fetch_historicos.py ya marca
//    `pocoNegociada` (menos de la mitad de las ruedas con cambio de precio).
//
// 2) Un % suelto no dice nada. +3% en BVN es un martes cualquiera; +3% en
//    una tranquila es un terremoto. Por eso al lado del retorno va la FUERZA:
//    cuántas veces se movió por encima de lo que ESA acción suele moverse,
//    usando su propia volatilidad. Es lo que después le va a poner
//    temperatura a los titulares del robot de prensa: una noticia es
//    candente cuando la acción se salió de su rango, no cuando el titular
//    usa mayúsculas.
//
// LO QUE ESTO NO ES: no predice. Mide lo que YA pasó y lo ordena. Que algo
// haya subido no dice nada de si va a seguir subiendo (Regla de Oro: la app
// muestra, no recomienda).
// ─────────────────────────────────────────────────────────────────────────

// Ruedas de bolsa por plazo. Son sesiones, no días de calendario: el
// histórico de la BVL trae una fila por rueda.
// Los plazos salen de mirar 18 meses de historia (31-jul-2026), no de una
// costumbre. Dos cosas se vieron ahí:
//   · Quién lidera CAMBIA con el plazo: a 1 día y 1 semana mandan las
//     acereras (20.6% y 23.4% de las ventanas); las minas recién toman el
//     mando a las 2 semanas y llegan a 30% al mes. Un Radar con un solo
//     plazo largo cuenta siempre la misma película: minería.
//   · El de 60 días se fue. No es el horizonte de nadie que opere, y
//     empujaba todo hacia minería.
export const PLAZOS = [
  { ruedas: 1, corto: '1d', etiqueta: 'el día' },
  { ruedas: 5, corto: '1s', etiqueta: 'la semana' },
  { ruedas: 10, corto: '2s', etiqueta: 'dos semanas' },
  { ruedas: 15, corto: '3s', etiqueta: 'tres semanas' },
  { ruedas: 20, corto: '1m', etiqueta: 'el mes' },
]

const RUEDAS_ANIO = 252 // ruedas de bolsa en un año, para escalar la volatilidad

const EMPRESAS = new Map(empresasData.empresas.map((e) => [e.ticker, e]))

// Retorno % de una ventana de `ruedas` sesiones que TERMINA `atras` ruedas
// antes del último cierre. Con atras=0 es «lo que va del plazo»; con
// atras=1 es la misma ventana vista ayer (sirve para saber si algo acaba
// de cruzar el anillo); con atras=ruedas es la ventana ANTERIOR completa
// (sirve para ver si la acción se dio vuelta).
function retornoOffset(valores, ruedas, atras = 0) {
  const fin = valores.length - 1 - atras
  const ini = fin - ruedas
  if (ini < 0 || fin < 0) return null
  const antes = valores[ini][1]
  const ahora = valores[fin][1]
  if (!antes || !ahora) return null
  return ((ahora - antes) / antes) * 100
}

// Retorno % entre el último cierre y el de `ruedas` sesiones atrás.
function retorno(valores, ruedas) {
  return retornoOffset(valores, ruedas, 0)
}

// FUERZA: el retorno medido en "movimientos normales de esta acción".
// La volatilidad anual (que fetch_historicos.py ya calcula de los cierres
// reales) se escala al plazo con la raíz del tiempo: σ_plazo = σ_año ×
// √(ruedas/252). Si la acción hizo +7% y su movimiento normal a ese plazo es
// 2%, la fuerza es 3.5 → se salió de su rango. Sin volatilidad → null.
function movimientoNormal(volAnualPct, ruedas) {
  if (!volAnualPct) return null
  const esperado = volAnualPct * Math.sqrt(ruedas / RUEDAS_ANIO)
  return esperado || null
}

function fuerza(retornoPct, volAnualPct, ruedas) {
  const esperado = movimientoNormal(volAnualPct, ruedas)
  if (retornoPct == null || !esperado) return null
  return retornoPct / esperado
}

// ═════════════════════════════════════════════════════════════════════════
// 📡 LA FIRMA DEL CONTACTO — lo que el Sonar mira ADEMÁS de la fuerza
//
// Hasta acá el Sonar detectaba con un solo dato: cuánto se salió la acción de
// su vaivén. Eso responde «¿se movió?» y nada más. Las preguntas que uno se
// hace después están TODAS respondidas en archivos que el robot ya baja a
// diario y que nadie estaba leyendo:
//
//   ¿se movió sola o la arrastró su sector?      → los cierres de las otras 31
//   ¿fue de a poco o saltó en un día?            → los cierres diarios
//   ¿venía cayendo y se dio vuelta?              → la ventana anterior
//   ¿lo cruzó hoy o ya llevaba días afuera?      → la misma ventana vista ayer
//   ¿está en su techo del año o rebotando?       → min52/max52 de historicos
//   ¿esa caída es de verdad o pagó dividendo?    → dividendos.json
//   ¿de veras se puede comprar y vender?         → diasConCambio
//
// Nada de esto predice: sigue siendo descripción de lo que YA pasó, igual que
// la fuerza. Lo que cambia es que un contacto deja de ser un punto con un %
// y pasa a tener una FIRMA — como en un sonar de verdad, donde el operador no
// solo ve un eco: ve si viene subiendo, si va solo o en grupo, y si el ruido
// tiene forma de submarino o de cardumen.
//
// LA MÁS IMPORTANTE ES LA DEL DIVIDENDO, y es la única que quita en vez de
// poner: una acción que cae 4% el día que pagó su dividendo NO se movió, se
// le descontó la plata que repartió. Sin esa marca, el Sonar iba a seguir
// señalando como anomalía algo que es pura aritmética del calendario.
// ═════════════════════════════════════════════════════════════════════════

// RACHA: cuántas ruedas seguidas viene en la misma dirección. Las ruedas sin
// cambio de precio (la BVL repite el cierre cuando nadie operó) no cuentan
// pero tampoco cortan: no negociar no es un día en contra.
function racha(valores) {
  let dias = 0
  let sube = null
  for (let i = valores.length - 1; i > 0; i--) {
    const d = valores[i][1] - valores[i - 1][1]
    if (d === 0) continue
    const s = d > 0
    if (sube === null) sube = s
    else if (s !== sube) break
    dias++
  }
  return dias ? { dias, sube } : null
}

// CONCENTRACIÓN: qué parte del recorrido se hizo en UNA sola rueda. No es lo
// mismo un +9% que se armó en diez sesiones que un +9% que pasó entero un
// martes: el primero es una tendencia, el segundo es un evento con fecha, y
// esa fecha es la que hay que ir a buscar en los titulares.
//
// El % suelto no se puede comparar entre plazos: en una ventana de 5 ruedas la
// rueda más grande se lleva 41% del recorrido en un caso normal, y en una de
// 20 apenas 16% (medido sobre las 32 series el 02-ago-2026). Por eso lo que se
// guarda además es `veces`: cuánto pesó esa rueda comparada con lo que pesa
// una rueda cualquiera del mismo plazo (100/ruedas). Así el corte es el mismo
// para 5 que para 20.
function concentracion(valores, ruedas) {
  const n = valores.length
  if (ruedas < 2 || n < ruedas + 1) return null
  let mayor = null
  let sumaAbs = 0
  for (let i = n - ruedas; i < n; i++) {
    const antes = valores[i - 1][1]
    if (!antes) continue
    const r = (valores[i][1] / antes - 1) * 100
    sumaAbs += Math.abs(r)
    if (!mayor || Math.abs(r) > Math.abs(mayor.pct)) mayor = { pct: r, fecha: valores[i][0] }
  }
  if (!mayor || !sumaAbs) return null
  const parte = (Math.abs(mayor.pct) / sumaAbs) * 100
  return { ...mayor, parte, veces: parte / (100 / ruedas) }
}

// RANGO DE 12 MESES: dónde está el precio entre el piso y el techo del año.
// fetch_historicos.py ya deja min52/max52 calculados de los cierres reales.
// Un movimiento contra el techo del año no es igual a uno en la mitad del
// rango — y esto no lo dice ninguna teoría, lo dice que son precios a los que
// esta misma acción ya llegó.
function rango52(h, precio) {
  const min = h.min52
  const max = h.max52
  if (!min || !max || !precio || max <= min) return null
  return {
    min,
    max,
    desdeMax: (precio / max - 1) * 100, // negativo: cuánto le falta al techo
    sobreMin: (precio / min - 1) * 100,
    lugar: ((precio - min) / (max - min)) * 100, // 0 = piso del año, 100 = techo
  }
}

// ── El dividendo, que hace caer el precio sin que pase nada malo ──────────
// dividendos.json trae el historial con la fecha EX (el día en que la acción
// empieza a cotizar sin derecho al dividendo, que es cuando el precio se
// descuenta solo). Viene en formato de stockanalysis: "Jun 1, 2026".
const MESES = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }

function fechaISO(txt) {
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec((txt || '').trim())
  if (!m || !MESES[m[1]]) return null
  return `${m[3]}-${MESES[m[1]]}-${m[2].padStart(2, '0')}`
}

// El tipo de cambio del BCRP (promedio del último mes publicado). Se usa solo
// para poder decir «ese dividendo pesaba ~2.1% del precio» cuando la empresa
// paga en dólares y cotiza en soles. Es un promedio mensual, así que el número
// va con «≈» y jamás se usa para nada que no sea esta comparación.
const TC = cotizacionesData.macro?.tc?.ultimo?.valor || null

function enMoneda(monto, de, a) {
  if (!monto || !de || !a) return null
  const limpio = (s) => s.replace(/\s/g, '')
  if (limpio(de) === limpio(a)) return monto
  if (!TC) return null
  if (limpio(de) === 'US$' && limpio(a) === 'S/') return monto * TC
  if (limpio(de) === 'S/' && limpio(a) === 'US$') return monto / TC
  return null
}

const cacheDiv = new Map()
function exDividendos(ticker) {
  if (cacheDiv.has(ticker)) return cacheDiv.get(ticker)
  const lista = (dividendosData.empresas?.[ticker]?.historial || [])
    .map((d) => ({ fecha: fechaISO(d.fecha), monto: d.monto, moneda: d.moneda }))
    .filter((d) => d.fecha && d.monto > 0)
  cacheDiv.set(ticker, lista)
  return lista
}

// ¿Hay una fecha ex-dividendo cerca? Dos casos MUY distintos, y confundirlos
// era un error real: al probar esto contra los datos del 31-jul-2026, cuatro
// contactos (BACKUSI1, SCCO, CORAREI1, FIBPRIME) traían fechas de AGOSTO —
// dividendos ya anunciados que todavía no se pagaron. Decir de ellos «pagó
// dividendo, por eso cayó» habría sido explicar una caída con algo que aún no
// ocurrió.
//
//   · YA PASÓ (dentro de la ventana medida): parte de la caída que ve el
//     Sonar es el dividendo saliendo del precio, no el mercado castigando.
//   · VIENE (después del último cierre): el precio VA a descontar ese monto
//     el día ex. No es una opinión ni un pronóstico: es cómo funciona.
//
// En ninguno de los dos casos se corrige el precio — inventar un cierre que
// nunca existió sería peor que avisar.
const DIAS_EXDIV_PROXIMO = 21 // más allá de tres semanas ya no es "pronto"

function dividendoCerca(ticker, desdeISO, hastaISO, precio, moneda) {
  if (!desdeISO || !hastaISO) return null
  const limite = new Date(new Date(hastaISO).getTime() + DIAS_EXDIV_PROXIMO * 86400000)
    .toISOString().slice(0, 10)
  const d = exDividendos(ticker)
    .filter((x) => x.fecha >= desdeISO && x.fecha <= limite)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0]
  if (!d) return null
  const enSuMoneda = enMoneda(d.monto, d.moneda, moneda)
  return {
    fecha: d.fecha,
    monto: d.monto,
    moneda: d.moneda,
    futuro: d.fecha > hastaISO,
    dias: Math.round((new Date(d.fecha) - new Date(hastaISO)) / 86400000),
    // cuánto del precio es ese dividendo (aprox: TC promedio del último mes)
    pctDelPrecio: enSuMoneda && precio ? (enSuMoneda / precio) * 100 : null,
    convertido: enSuMoneda != null && d.moneda?.replace(/\s/g, '') !== moneda?.replace(/\s/g, ''),
  }
}

// El Hecho de Importancia más reciente de la empresa (hechos.json viene
// ordenado del más nuevo al más viejo). Es el puente con el lado noticias:
// una acción que se salió de su rango Y publicó algo esta semana es otra
// cosa que una que se movió sola.
// `hechosVivos` (opcional) es lo que baja lib/vivo.js del mismo endpoint de
// la BVL, sin esperar al robot. Gana el más reciente, y con fecha empatada
// gana el vivo porque trae la HORA. Esto es lo que hace que un Hecho salga en
// el Sonar a los segundos de publicarse: el 03-ago-2026 Alicorp publicó su
// compra a Unilever a las 07:08 y el archivo del repo seguía clavado en el 24
// de julio.
function ultimoHecho(ticker, hoyISO, hechosVivos) {
  const guardado = hechosData.hechos?.[ticker]?.hechos?.[0]
  const fresco = hechosVivos?.[ticker]?.[0]
  const h = fresco?.fecha && (!guardado?.fecha || fresco.fecha >= guardado.fecha)
    ? fresco : guardado
  if (!h?.fecha) return null
  const dias = Math.round((new Date(hoyISO) - new Date(h.fecha)) / 86400000)
  return {
    fecha: h.fecha,
    titulo: h.titulo || '',
    categoria: h.categoria || '',
    pdf: h.pdf || null, // el documento oficial: siempre a un clic
    hora: h.hora || null,
    envivo: !!h.envivo,
    dias: isFinite(dias) && dias >= 0 ? dias : null,
  }
}

// ── EL PRECIO DE HOY, PEGADO AL FINAL DE LA SERIE ────────────────────────
//
// historicos.json solo se rehace en el cierre de las 22:23, así que durante
// la rueda su última fila es el cierre de AYER. El precio de hoy vive aparte
// (precios.json, o el vivo que baja el navegador). Mientras estuvieron
// separados el Sonar decía dos cosas a la vez: la ficha mostraba «S/ 2.70» y
// el punto se dibujaba en la posición que le tocaba a S/ 2.45.
//
// Acá se juntan. La regla es la fecha de la SESIÓN (la de la última
// operación, no la de nuestra consulta):
//   · sesión POSTERIOR al último cierre -> se agrega una fila: hoy existe.
//   · sesión IGUAL al último cierre     -> se reemplaza: es el mismo día,
//     más fresco.
//   · sesión ANTERIOR (o sin dato)      -> no se toca NADA. Esto es lo que
//     protege de la acción que lleva días sin negociar: la BVL repite su
//     último cierre, y estamparlo como si fuera de hoy inventaría un día que
//     no existió.
//
// Al agregar una fila, las ventanas se corren solas: `atras=1` pasa a ser
// «esta misma ventana vista en el cierre anterior», que es justo lo que la
// firma necesita para saber si el contacto acaba de cruzar el anillo.
// ── LAS RUEDAS QUE EL ROBOT NO ALCANZÓ A GUARDAR ─────────────────────────
//
// historicos.json se rehace solo en el cierre de las 22:23. Si el robot no
// corre —el 03-ago-2026 llevaba dos días sin correr— el archivo se va
// quedando ruedas atrás, y entonces «dos semanas» deja de medir dos semanas:
// mide desde una fecha vieja hasta otra fecha vieja.
//
// Esto pega al final las ruedas que faltan, bajadas en vivo del mismo
// endpoint de la BVL. Solo se agregan fechas POSTERIORES a la última del
// archivo: nunca se reescribe un cierre ya guardado.
function conCola(base, cola) {
  if (!cola?.length) return base
  const ultima = base[base.length - 1][0]
  const nuevas = cola
    .filter(([f, v]) => f > ultima && v > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  return nuevas.length ? [...base, ...nuevas] : base
}

// Qué le falta al archivo: los tickers que el Radar realmente usa y la última
// fecha guardada. Con esto lib/vivo.js sabe qué pedir y desde cuándo, sin
// tener que conocer las reglas del Radar.
export function huecoHistorico() {
  const tickers = []
  let ultima = null
  for (const [ticker, h] of Object.entries(historicosData.historicos || {})) {
    if (!EMPRESAS.has(ticker) || h.pocoNegociada) continue
    const vals = (h.valores || []).filter(([, v]) => v > 0)
    if (vals.length < 21) continue
    tickers.push(ticker)
    const f = vals[vals.length - 1][0]
    if (!ultima || f > ultima) ultima = f
  }
  return { tickers, ultima }
}

function conUltimoPrecio(base, px) {
  const precio = px?.precio
  if (!(precio > 0)) return base
  const sesion = (px.ultimaOperacion || '').slice(0, 10) || px.fecha
  if (!sesion) return base
  const ultima = base[base.length - 1][0]
  if (sesion > ultima) return [...base, [sesion, precio]]
  if (sesion === ultima) return [...base.slice(0, -1), [sesion, precio]]
  return base
}

// ── Las filas del Radar: una por acción realmente negociable.
//
// `vivos` (opcional) es el mapa ticker -> precio que baja lib/vivo.js
// directo de la BVL. Cuando llega, manda sobre el precios.json horneado y el
// Radar entero —plato, ranking, sectores, candente— se recalcula con él. Sin
// él, todo funciona igual que siempre con el dato del robot.
export function filasRadar(vivos = null, hechosVivos = null, cola = null) {
  const filas = []
  let descartadas = 0
  const fechas = {}

  for (const [ticker, h] of Object.entries(historicosData.historicos || {})) {
    const emp = EMPRESAS.get(ticker)
    if (!emp) continue
    const guardadas = (h.valores || []).filter(([, v]) => v > 0)
    if (guardadas.length < 21) { descartadas++; continue }
    // Regla 1: el precio congelado no es una tendencia, es un archivo viejo.
    if (h.pocoNegociada) { descartadas++; continue }

    // Primero las ruedas que el robot no alcanzó a guardar, después el precio
    // de hoy. En ese orden: la cola trae cierres cerrados, el precio de hoy
    // es la rueda en curso.
    const base = conCola(guardadas, cola?.[ticker])
    const px = vivos?.[ticker] || preciosData.precios?.[ticker]
    const valores = conUltimoPrecio(base, px)
    const fechaCierre = valores[valores.length - 1][0]
    fechas[fechaCierre] = (fechas[fechaCierre] || 0) + 1
    const retornos = {}
    const fuerzas = {}
    const normales = {}
    // DE DÓNDE VENÍA: el cierre con el que arranca cada ventana. Sin esto, un
    // «+10.5%» es un número en el aire; con esto es «estaba en S/ 2.45 y está
    // en S/ 2.70», que es lo que uno mira antes de decidir nada.
    const desde = {}
    // LA FIRMA, plazo por plazo: todo lo que el Sonar mira además del %.
    const senales = {}
    const precio = px?.precio ?? valores[valores.length - 1][1]
    const moneda = (px?.moneda || h.moneda || '').trim()
    for (const p of PLAZOS) {
      retornos[p.ruedas] = retorno(valores, p.ruedas)
      fuerzas[p.ruedas] = fuerza(retornos[p.ruedas], h.volatilidadAnualPct, p.ruedas)
      normales[p.ruedas] = movimientoNormal(h.volatilidadAnualPct, p.ruedas)
      const i = valores.length - 1 - p.ruedas
      desde[p.ruedas] = i >= 0 ? { precio: valores[i][1], fecha: valores[i][0] } : null

      const previo = retornoOffset(valores, p.ruedas, p.ruedas)
      const ayer = retornoOffset(valores, p.ruedas, 1)
      senales[p.ruedas] = {
        previo,                                    // la ventana anterior, para el giro
        fuerzaPrevia: fuerza(previo, h.volatilidadAnualPct, p.ruedas),
        retornoAyer: ayer,                         // la misma ventana, vista ayer
        fuerzaAyer: fuerza(ayer, h.volatilidadAnualPct, p.ruedas),
        concentracion: concentracion(valores, p.ruedas),
        dividendo: dividendoCerca(ticker, desde[p.ruedas]?.fecha, fechaCierre, precio, moneda),
        // se completan en la segunda pasada, cuando ya existen las otras filas
        medianaSector: null,
        medianaMercado: null,
        exceso: null,
      }
    }

    filas.push({
      ticker,
      nombre: emp.nombre,
      sector: emp.sector || 'sin sector',
      retornos,
      fuerzas,
      normales,
      desde,
      senales,
      racha: racha(valores),
      rango52: rango52(h, precio),
      // Qué tan seguido se puede entrar y salir de verdad. Una acción que
      // cambia de precio 6 de cada 10 ruedas se mueve más por falta de
      // contraparte que por noticias.
      liquidezPct: h.diasConCambio && h.volatilidadDias
        ? (h.diasConCambio / h.volatilidadDias) * 100 : null,
      volatilidadAnualPct: h.volatilidadAnualPct ?? null,
      volatilidadEtiqueta: h.volatilidadEtiqueta || null,
      diasConCambio: h.diasConCambio ?? null,
      // ── CON CUÁNTA PLATA se movió (desde el 02-ago-2026; el endpoint de
      // mercado siempre lo trajo y fetch_precios.py lo tiraba).
      //
      // No sirve para descartar una subida —toda subida es buena para quien la
      // toma— sino para saber DE QUÉ TAMAÑO era tomable. Siderperú hizo +10.5%
      // con 13 operaciones y S/ 13,818 en toda la rueda, y con 1.8% de spread
      // entre la compra y la venta. El mismo día BBVA movió S/ 579,085 en 69
      // operaciones. El Sonar los pintaba idénticos.
      volumen: px?.operaciones != null ? {
        operaciones: px.operaciones,
        monto: px.montoNegociado ?? null,
        cantidad: px.cantidadNegociada ?? null,
        // el rango REAL del día, sin tener que consultar cada 10 minutos
        apertura: px.apertura ?? null,
        minimo: px.minimo ?? null,
        maximo: px.maximo ?? null,
        // la hora de la última operación: dice si negoció hasta el cierre o
        // se quedó muda a las once de la mañana, que no es lo mismo
        ultima: px.ultimaOperacion || null,
      } : null,
      precio,
      moneda,
      fechaCierre,
      // Si ESTE precio vino del navegador o del archivo. Por acción y no
      // global: en una misma pantalla puede haber contactos con precio de
      // hace segundos y otros que no negocian desde el jueves.
      envivo: !!px?.envivo,
      hecho: ultimoHecho(ticker, fechaCierre, hechosVivos),
    })
  }

  // SEGUNDA PASADA: ¿se movió sola o la movieron con todas? Esto no se puede
  // saber mirando una acción — hace falta el resto del plato, y por eso va
  // acá y no adentro del bucle.
  for (const p of PLAZOS) {
    const porSector = new Map()
    for (const f of filas) {
      if (f.retornos[p.ruedas] == null) continue
      if (!porSector.has(f.sector)) porSector.set(f.sector, [])
      porSector.get(f.sector).push(f.retornos[p.ruedas])
    }
    const medMercado = mediana(filas.map((f) => f.retornos[p.ruedas]))
    for (const f of filas) {
      const s = f.senales[p.ruedas]
      const lista = porSector.get(f.sector) || []
      // Con una sola acción en el sector no hay "sector": es ella misma, y
      // compararla consigo misma diría siempre "se movió sola".
      s.medianaSector = lista.length >= 2 ? mediana(lista) : null
      s.medianaMercado = medMercado
      s.exceso = s.medianaSector != null && f.retornos[p.ruedas] != null
        ? f.retornos[p.ruedas] - s.medianaSector : null
    }
  }

  // La fecha de cierre que comparte la mayoría (igual que HoyBVL): alguna
  // acción puede traer una rueda de menos y no por eso mentimos la fecha.
  const fecha = Object.entries(fechas).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const total = Object.keys(historicosData.historicos || {}).length

  return { filas, descartadas, total, fecha }
}

function mediana(nums) {
  const l = nums.filter((n) => n != null).sort((a, b) => a - b)
  if (!l.length) return null
  const m = Math.floor(l.length / 2)
  return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2
}

// ── La rotación: qué SECTOR se está moviendo, no qué acción suelta.
// Mediana y no promedio: con 2-3 nombres por sector, un caso raro arrastra
// el promedio y cuenta una película que no pasó. Devuelve también los
// tickers que lo componen — con sectores tan chicos, el que mira tiene
// derecho a ver de quién sale el número (y a notar si alguno está mal
// clasificado).
export function rotacionSectores(filas, ruedas) {
  const porSector = new Map()
  for (const f of filas) {
    if (f.retornos[ruedas] == null) continue
    if (!porSector.has(f.sector)) porSector.set(f.sector, [])
    porSector.get(f.sector).push(f)
  }
  return [...porSector.entries()]
    .map(([sector, lista]) => ({
      sector,
      n: lista.length,
      mediana: mediana(lista.map((f) => f.retornos[ruedas])),
      tickers: lista.map((f) => f.ticker),
    }))
    .filter((s) => s.mediana != null)
    .sort((a, b) => b.mediana - a.mediana)
}

// ── EL CRUCE: dónde "candente" deja de ser un adjetivo ────────────────────
//
// Un titular no es candente por sí solo. Todos los titulares se creen
// candentes — están escritos para eso. Candente es cuando la acción SE SALIÓ
// de su vaivén normal, y eso lo dice el precio, no el redactor.
//
// Así que el orden es: primero se filtra por fuerza (|f| ≥ 1 = se salió de su
// rango), y RECIÉN ahí se le cuelga lo que se publicó alrededor. Nunca al
// revés — si dejáramos que el titular decida, tendríamos 110 noticias
// "urgentes" por semana y ninguna forma de saber cuál mirar.
//
// HONESTIDAD (Regla #1): que la noticia y el movimiento coincidan en el
// tiempo NO significa que una causó al otro. Esto pone las dos cosas al lado
// para que las mires; el porqué lo pones tú.
const UMBRAL_CANDENTE = 1 // se movió al menos 1× su vaivén normal

// ── EL PESO: cuánto te dice ESTE titular sobre por qué se movió algo ──────
// Lo pone el robot de prensa (extractor/fetch_noticias.py) mirando de qué
// habla. Sirve para elegir cuál titular se muestra cuando solo cabe uno.
//
// Por qué hizo falta: al ampliar la red de prensa, SIDERC1 cruzó el anillo
// con +10.5% y el titular que la app le ponía al lado era «SIDERPERU obtiene
// recertificación como Buen Empleador». Ninguna de las dos cosas era falsa y
// la frase completa era una tontería. El peso no borra nada — esas notas
// siguen ahí, se ven, se pueden leer — pero nunca encabezan.
//
// LO QUE EL PESO NO ES, Y SE COMPROBÓ: no predice. Se midieron 2,259
// titulares de un año contra los cierres reales (extractor/estudio_noticias.py)
// y un día con titular se mueve apenas 1.2× lo que un día sin titular, efecto
// que a las 10 ruedas ya no existe. Ninguna palabra de contenido se separó del
// ruido. Así que el peso ordena la LECTURA, no anticipa el precio: quien dice
// si algo fue candente sigue siendo la fuerza del movimiento, nunca el titular.
//
// El `?? 1` no es adorno: los titulares guardados antes de que existiera el
// peso no lo traen, y un archivo viejo debe seguir mostrándose.
export const pesoDe = (n) => n?.peso ?? 1

// Del más capaz de explicar al menos, y a igual peso el más reciente.
function porPesoYFecha(a, b) {
  return (pesoDe(b) - pesoDe(a)) || (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)
}

export function noticiasDe(ticker) {
  return noticiasData.porEmpresa?.[ticker] || []
}

// Los titulares de una acción, del que más puede explicar un movimiento al que
// menos. Es la que se usa para elegir cuál ENCABEZA en el Sonar: ahí solo cabe
// uno, y tiene que ser el que tenga algo que ver con el precio.
export function noticiasOrdenadas(ticker) {
  return [...noticiasDe(ticker)].sort(porPesoYFecha)
}

// ── «TAL VEZ SUBE POR ESTO» — la explicación POSIBLE, con su prueba ──────
//
// Un titular solo puede ser candidato a explicar un movimiento si CAYÓ
// DENTRO de la ventana de ese movimiento. Una nota de hace 15 días no
// explica lo que pasó esta semana, por buena que suene.
//
// Y como el histórico tiene los cierres diarios, no hay que quedarse en la
// coincidencia de fechas: se puede medir QUÉ HIZO EL PRECIO desde el día de
// cada titular. Eso convierte «tal vez sea por esta noticia» en algo que el
// lector puede comprobar con el número al lado, en vez de creérselo.
//
// LÍMITE QUE NO SE PUEDE SALTAR: esto sigue sin probar causa. Que el precio
// subiera después del titular no significa que subiera POR el titular —
// pudo ser el metal, el mercado entero o nada. Por eso todo lo que sale de
// acá se rotula «posible» y jamás «porque».
export function noticiasConEfecto(ticker, ruedas) {
  const h = historicosData.historicos?.[ticker]
  const vals = (h?.valores || []).filter(([, v]) => v > 0)
  if (vals.length < 2) return []
  const ultimo = vals[vals.length - 1][1]
  const idxIni = Math.max(0, vals.length - 1 - ruedas)
  const fechaIni = vals[idxIni][0]

  return noticiasDe(ticker).map((n) => {
    // Cierre del día del titular (o el hábil anterior si salió en fin de semana)
    let base = null
    let baseFecha = null
    for (const [f, v] of vals) {
      if (f > n.fecha) break
      base = v
      baseFecha = f
    }
    return {
      ...n,
      dentroDeVentana: n.fecha >= fechaIni,
      desdeElTitular: base ? (ultimo / base - 1) * 100 : null,
      baseFecha,
    }
  })
}

// Los candidatos a explicar el movimiento: dentro de la ventana, en la misma
// dirección que se movió la acción Y capaces de mover un precio. Ordenados
// por el efecto medido.
//
// El filtro por peso está acá y no en el muro porque acá es donde de verdad
// duele: esta lista es la que la app rotula «tal vez sube por esto». Decir
// «tal vez subió 10.5% por su recertificación de Buen Empleador» no es un
// titular flojo, es una afirmación falsa con un número al lado que la hace
// parecer medida.
export function posiblesExplicaciones(ticker, ruedas, subio) {
  return noticiasConEfecto(ticker, ruedas)
    .filter((n) => n.dentroDeVentana && n.desdeElTitular != null
      && pesoDe(n) > 0
      && (subio ? n.desdeElTitular > 0 : n.desdeElTitular < 0))
    .sort((a, b) => Math.abs(b.desdeElTitular) - Math.abs(a.desdeElTitular))
}

export function candentes(filas, ruedas, diasNoticia = 12) {
  const hoy = new Date()
  const frescas = (items) => items.filter((n) => {
    const d = (hoy - new Date(n.fecha)) / 86400000
    return d >= 0 && d <= diasNoticia
  })

  return filas
    .filter((f) => f.fuerzas[ruedas] != null && Math.abs(f.fuerzas[ruedas]) >= UMBRAL_CANDENTE)
    .map((f) => ({
      fila: f,
      // Por peso y no por fecha: la que encabeza es la que PUEDE explicar el
      // movimiento, no la que se publicó más tarde.
      noticias: frescas(noticiasDe(f.ticker)).sort(porPesoYFecha).slice(0, 3),
      // el Hecho de Importancia pesa más que la prensa: es la fuente primaria
      hecho: f.hecho?.dias != null && f.hecho.dias <= diasNoticia ? f.hecho : null,
    }))
    .sort((a, b) => Math.abs(b.fila.fuerzas[ruedas]) - Math.abs(a.fila.fuerzas[ruedas]))
}

// Los TEMAS de sector/macro: lo que movió a un sector ENTERO y que ningún
// Hecho de Importancia cubre (un antidumping al acero chino no le pertenece a
// ninguna empresa). Se devuelven con los sectores a los que les pega, para
// poder ponerlos al lado de la rotación.
export function temasDeSector(sectoresVisibles = null) {
  const temas = Object.entries(noticiasData.temas || {})
    .map(([id, t]) => ({ id, ...t }))
    .filter((t) => (t.items || []).length > 0)
  if (!sectoresVisibles) return temas
  return temas.filter(
    (t) => !t.sectores?.length || t.sectores.some((s) => sectoresVisibles.includes(s)),
  )
}

export const noticiasGeneradas = noticiasData.generado || null

// ═════════════════════════════════════════════════════════════════════════
// 🌍 EL MUNDO — lo que le llega a la BVL desde afuera
//
// De las 32 acciones que se negocian, 10 son minas y ninguna le pone precio a
// lo que vende: se lo ponen en Londres y en Chicago. Con las 2 acereras (que
// compiten contra el acero chino) y los 3 fondos (que siguen al mercado
// entero), más de un tercio del plato tiene la causa fuera del país.
//
// LA REGLA QUE HACE HONESTA LA FRASE «puede afectar a X»: nunca se muestra un
// ticker colgado de un titular. Se muestra el CANAL — la cadena por la que eso
// llegaría hasta esa empresa (fetch_noticias.py → MUNDO → afecta[].via):
//
//     la Fed baja tasas → el dólar se debilita → el cobre sube → Cerro Verde
//
// Cada eslabón es discutible y el lector puede romperlo. Eso es exactamente lo
// que se quiere: un adivino no se puede contradecir, una cadena sí.
//
// LO QUE ESTO NO ES: nada de acá se midió contra el precio. `estudio_noticias.py`
// mostró que ni los titulares de la propia empresa predicen su cierre; uno de
// la Fed, menos. No ordena por importancia ni anuncia nada — pone al lado del
// contacto por dónde podría estarle entrando el mundo, para saber dónde mirar.
// Por eso todo va rotulado «puede», jamás «va a» ni «por eso subió».
const DIAS_MUNDO = 10 // más viejo que esto ya no es contexto, es historia

function frescos(items, dias = DIAS_MUNDO) {
  const hoy = new Date()
  return (items || []).filter((n) => {
    const d = (hoy - new Date(n.fecha)) / 86400000
    return d >= 0 && d <= dias
  })
}

// Los temas de mundo que tienen algo reciente, con sus titulares ya podados.
export function temasDelMundo() {
  return Object.entries(noticiasData.mundo || {})
    .map(([id, t]) => ({ ...t, id, items: frescos(t.items) }))
    .filter((t) => t.items.length > 0)
    // El que más ha publicado encabeza: no es "importancia", es actividad.
    .sort((a, b) => b.items.length - a.items.length)
}

// El cruce al revés: qué le puede estar llegando a ESTA empresa, y por dónde.
let cacheMundoTk = null
function mundoPorTicker() {
  if (cacheMundoTk) return cacheMundoTk
  const m = new Map()
  for (const t of temasDelMundo()) {
    for (const canal of t.afecta || []) {
      for (const tk of canal.tickers || []) {
        if (!m.has(tk)) m.set(tk, [])
        m.get(tk).push({
          id: t.id, titulo: t.titulo, icono: t.icono,
          via: canal.via,
          items: t.items,
          ultimo: t.items[0] || null,
        })
      }
    }
  }
  cacheMundoTk = m
  return m
}

export function mundoDe(ticker) {
  return mundoPorTicker().get(ticker) || []
}

// Los tickers del universo a los que hoy les llega algo de afuera — para poder
// marcarlos en la lista sin abrir cada uno.
export function tickersTocadosPorElMundo() {
  return new Set(mundoPorTicker().keys())
}

// ── EL MURO: todos los titulares en un solo flujo, el más nuevo arriba ─────
// Formato terminal (estilo tablero de sala de trading): no importa si el
// titular vino por empresa o por tema — importa CUÁNDO salió. Cada uno se
// queda con su origen para poder etiquetarlo.
// Cuántos titulares como máximo aporta UNA empresa al flujo. Sin este tope,
// la prensa minera peruana (Rumbo Minero, Energiminas, Minería en Línea…)
// se come el tablero: medido el 31-jul-2026, minas ponía 50 de 142 titulares
// y acereras 7 — y los primeros 20 del muro eran cinco PLUZENC1 seguidos y
// cuatro CVERDEC1. Que una empresa tenga más prensa no la hace más
// importante; solo la hace más ruidosa.
const CUPO_POR_EMPRESA = 2

export function muroTitulares(filas = [], ruedas = 20) {
  // Cuánto se movió cada acción, para poder ordenar por eso y no por quién
  // tiene mejor equipo de prensa.
  const fuerzaDe = new Map()
  const sectorFuerza = new Map()
  for (const f of filas) {
    const fz = Math.abs(f.fuerzas?.[ruedas] ?? 0)
    fuerzaDe.set(f.ticker, fz)
    sectorFuerza.set(f.sector, Math.max(sectorFuerza.get(f.sector) ?? 0, fz))
  }

  const flujo = []
  for (const [ticker, items] of Object.entries(noticiasData.porEmpresa || {})) {
    const emp = EMPRESAS.get(ticker)
    for (const n of items) {
      flujo.push({
        ...n, origen: 'empresa', ticker, etiqueta: ticker,
        sector: emp?.sector || null,
        fuerza: fuerzaDe.get(ticker) ?? 0,
      })
    }
  }
  for (const [id, t] of Object.entries(noticiasData.temas || {})) {
    // Un tema de sector pesa lo que pesa el sector al que le pega: el
    // antidumping del acero vale lo que se estén moviendo las acereras.
    const suFuerza = (t.sectores || []).length
      ? Math.max(...(t.sectores || []).map((s) => sectorFuerza.get(s) ?? 0))
      : 0
    for (const n of t.items || []) {
      flujo.push({ ...n, origen: 'tema', temaId: id, etiqueta: t.titulo,
        icono: t.icono || n.icono, sectores: t.sectores || [], fuerza: suFuerza })
    }
  }

  // Dedup: la misma nota puede caer por la consulta de la empresa Y por la
  // del tema (pasó con el antidumping, que salía por "acero" y por Siderperú).
  const vistos = new Set()
  const unicos = flujo.filter((n) => (vistos.has(n.url) ? false : vistos.add(n.url)))

  // ORDEN: primero lo que SE MOVIÓ; a igual movimiento, lo que puede
  // explicarlo; y recién ahí, lo más reciente.
  // (Antes era solo por fecha, y como 60 titulares comparten el mismo día el
  //  desempate quedaba al azar del recorrido — de ahí los bloques por ticker.)
  unicos.sort((a, b) => (b.fuerza - a.fuerza) || porPesoYFecha(a, b))

  // CUPO: se reparte en vueltas. Primera vuelta, el titular más fuerte de
  // cada empresa; segunda vuelta, el segundo de cada una. Así el tablero
  // arranca con una acción distinta en cada línea en vez de bloques.
  const porEmpresa = new Map()
  const vueltas = []
  for (const n of unicos) {
    const clave = n.ticker || `tema:${n.temaId}`
    const i = porEmpresa.get(clave) ?? 0
    porEmpresa.set(clave, i + 1)
    if (i >= CUPO_POR_EMPRESA) continue
    if (!vueltas[i]) vueltas[i] = []
    vueltas[i].push(n)
  }
  const flujoFinal = vueltas.flat()
  // Los que quedaron fuera del cupo van al final: no se pierden, solo dejan
  // de tapar a los demás.
  const dentro = new Set(flujoFinal.map((n) => n.url))
  return [...flujoFinal, ...unicos.filter((n) => !dentro.has(n.url))]
}

// Los sectores presentes en el muro, para los filtros. Ordenados por cuánto
// se movió el sector (no alfabéticamente: el que se movió va primero).
export function sectoresDelMuro(titulares) {
  const cuenta = new Map()
  for (const n of titulares) {
    const claves = n.origen === 'tema' ? (n.sectores || []) : (n.sector ? [n.sector] : [])
    for (const s of claves) cuenta.set(s, (cuenta.get(s) ?? 0) + 1)
  }
  return [...cuenta.entries()].map(([sector, n]) => ({ sector, n })).sort((a, b) => b.n - a.n)
}

// ── QUÉ ES "NUEVO" ────────────────────────────────────────────────────────
// Nuevo = no lo habías visto tú, no "publicado hoy". Es la diferencia entre
// un tablero que te sirve y uno que grita NUEVO todos los días sobre lo
// mismo. Se guarda el set de URL ya vistas en el navegador (nada viaja a
// ningún lado) y se marca al SALIR, no al entrar: así el distintivo aguanta
// toda la visita en vez de apagarse mientras lo lees.
const CLAVE_VISTOS = 'alto-muro-vistos'
const TOPE_VISTOS = 600 // techo sano: ~20 días de titulares con holgura

export function leerVistos() {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_VISTOS) || '[]')
    return new Set(Array.isArray(crudo) ? crudo : [])
  } catch {
    return new Set() // sin storage (o modo incógnito): todo se ve nuevo, y está bien
  }
}

export function marcarVistos(urls) {
  try {
    const set = leerVistos()
    for (const u of urls) set.add(u)
    // se conservan los últimos: si crece sin tope, un día no entra en storage
    const lista = [...set].slice(-TOPE_VISTOS)
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify(lista))
  } catch { /* sin storage: no pasa nada, solo no recuerda */ }
}

// ── APRENDER DEL PASADO ───────────────────────────────────────────────────
// 18 meses de cierres reales están en el repo y nunca se habían mirado hacia
// atrás. Sirven para responder la única pregunta que importa antes de entrar:
// ¿lo que busco cabe en el plazo que estoy mirando?
//
// Se recorre la historia en ventanas deslizantes del plazo elegido y se
// cuenta qué pasó de verdad. No predice nada: describe lo que ocurrió.
//
// AVISO QUE VA EN PANTALLA: estos 18 meses fueron de un mercado que subió.
// Por eso casi todas las acciones tienen saldo positivo — no es que sean
// buenas, es que el periodo lo fue. Un tramo de bajada daría lo contrario.

let cacheSeries = null
function series() {
  if (cacheSeries) return cacheSeries
  const porTicker = new Map()
  const fechas = new Set()
  for (const [ticker, h] of Object.entries(historicosData.historicos || {})) {
    if (h.pocoNegociada || !EMPRESAS.has(ticker)) continue
    const m = new Map()
    for (const [f, v] of h.valores || []) {
      if (v > 0) { m.set(f, v); fechas.add(f) }
    }
    if (m.size > 30) porTicker.set(ticker, m)
  }
  cacheSeries = { porTicker, fechas: [...fechas].sort() }
  return cacheSeries
}

const cacheHistoria = new Map()

export function historiaDelPlazo(ruedas) {
  if (cacheHistoria.has(ruedas)) return cacheHistoria.get(ruedas)
  const { porTicker, fechas } = series()
  if (fechas.length <= ruedas + 5) return null

  const lideraSector = new Map()
  const magnitudes = []
  let ventanas = 0
  let liderSobre5 = 0
  const cuenta = new Map() // ticker -> {sube5, baja5, total}

  for (let i = ruedas; i < fechas.length; i++) {
    const ini = fechas[i - ruedas]
    const fin = fechas[i]
    const porSector = new Map()

    for (const [ticker, m] of porTicker) {
      const a = m.get(ini)
      const b = m.get(fin)
      if (!a || !b) continue
      const r = (b / a - 1) * 100
      const c = cuenta.get(ticker) || { sube5: 0, baja5: 0, total: 0 }
      c.total++
      if (r >= 5) c.sube5++
      if (r <= -5) c.baja5++
      cuenta.set(ticker, c)
      const sec = EMPRESAS.get(ticker)?.sector
      if (!sec) continue
      if (!porSector.has(sec)) porSector.set(sec, [])
      porSector.get(sec).push(r)
    }

    // Mediana por sector, y quién lideró esa ventana. Se piden 2 acciones
    // mínimo por sector: con una sola no es un sector, es una empresa.
    const medianas = [...porSector.entries()]
      .filter(([, l]) => l.length >= 2)
      .map(([s, l]) => [s, mediana(l)])
    if (medianas.length < 3) continue
    const [secTop, valTop] = medianas.reduce((a, b) => (b[1] > a[1] ? b : a))
    if (Math.abs(valTop) < 0.01) continue // mercado plano: no lideró nadie
    lideraSector.set(secTop, (lideraSector.get(secTop) || 0) + 1)
    magnitudes.push(valTop)
    if (valTop >= 5) liderSobre5++
    ventanas++
  }

  if (!ventanas) return null

  const empresas = [...cuenta.entries()]
    .filter(([, c]) => c.total > 60) // sin historia suficiente no se opina
    .map(([ticker, c]) => {
      const e = EMPRESAS.get(ticker)
      const sube5 = (c.sube5 / c.total) * 100
      const baja5 = (c.baja5 / c.total) * 100
      return {
        ticker,
        nombre: e?.nombre || ticker,
        sector: e?.sector || '?',
        sube5,
        baja5,
        saldo: sube5 - baja5,
        volatilidadAnualPct: historicosData.historicos?.[ticker]?.volatilidadAnualPct ?? null,
      }
    })
    .sort((a, b) => b.saldo - a.saldo)

  const res = {
    ruedas,
    ventanas,
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
    liderPasa5: (liderSobre5 / ventanas) * 100,
    liderTipico: mediana(magnitudes),
    sectores: [...lideraSector.entries()]
      .map(([sector, n]) => ({ sector, n, pct: (n / ventanas) * 100 }))
      .sort((a, b) => b.pct - a.pct),
    empresas,
  }
  cacheHistoria.set(ruedas, res)
  return res
}

// Cómo se lee la fuerza en palabras. Los cortes no son mágicos: por debajo de
// 1 la acción hizo lo que suele hacer, y ahí el dato ÚTIL no es "no pasó nada"
// sino CUÁNTO es su rango normal — así se ve si el movimiento que uno persigue
// cabe dentro del ruido de esa acción o no.
export function leerFuerza(f, normal) {
  if (f == null) {
    return normal ? { nivel: 0, texto: `su vaivén normal: ±${normal.toFixed(1)}%`, icono: '' } : null
  }
  const a = Math.abs(f)
  if (a < 1) {
    // «normal para ella» y no «dentro de lo suyo»: lo segundo suena a
    // descarte, y no lo es. Una subida de 9% son 9% de plata aunque esa acción
    // se mueva así todas las semanas — lo que dice esta línea es que NO es
    // detectable como anomalía, no que no valga.
    return {
      nivel: 0,
      texto: normal ? `su vaivén normal: ±${normal.toFixed(1)}%` : 'normal para ella',
      icono: '',
    }
  }
  if (a < 2) return { nivel: 1, texto: `${a.toFixed(1)}× su vaivén normal`, icono: '🔥' }
  return { nivel: 2, texto: `${a.toFixed(1)}× su vaivén normal`, icono: '🔥🔥' }
}

// ── LEER LA FIRMA: de números a marcas que se entienden de un vistazo ─────
//
// Cada marca tiene que pasar el mismo examen que la fuerza: no vale si no se
// puede comprobar con el número al lado. Por eso todas llevan su cuenta
// escrita («el 78% del movimiento se hizo el 29-jul»), y ninguna dice qué
// hacer con eso.
//
// LOS CORTES SON DE LA ACCIÓN, NO DEL LIBRO: casi todos se miden contra el
// vaivén normal de ESA acción (el mismo σ del plazo que usa la fuerza), no
// contra un % fijo. Un 3% no significa lo mismo en BVN que en una eléctrica,
// y un umbral fijo volvería a meter por la ventana el problema que la fuerza
// echó por la puerta.
const pct = (n, d = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}%`

export function firmaDe(f, ruedas) {
  const s = f.senales?.[ruedas]
  const ret = f.retornos?.[ruedas]
  if (!s || ret == null) return []
  const fz = f.fuerzas?.[ruedas]
  const normal = f.normales?.[ruedas] || 3 // sin volatilidad, un corte prudente
  const marcas = []

  // 1) EL DIVIDENDO PRIMERO: es la única marca que le quita valor al
  //    movimiento en vez de dárselo. Va arriba porque cambia la lectura de
  //    todo lo demás.
  if (s.dividendo) {
    const d = s.dividendo
    const cuanto = d.pctDelPrecio
      ? `${d.convertido ? '≈' : ''}${d.pctDelPrecio.toFixed(1)}% del precio`
      : `${d.moneda} ${d.monto} por acción`
    marcas.push(d.futuro
      ? {
        id: 'exdiv', icono: '📅', corto: `dividendo en ${d.dias}d`,
        texto: `El ${d.fecha} es la fecha ex-dividendo: ese día el precio descuenta solo el dividendo (${cuanto}). No es una caída del mercado, es cómo funciona.`,
      }
      : {
        id: 'dividendo', icono: '💸', corto: 'pagó dividendo',
        texto: `El ${d.fecha}, dentro de este mismo plazo, pasó su fecha ex-dividendo: repartió ${cuanto} y la cotización lo descontó sola ese día. Esa parte de la caída no la hizo el mercado.`,
      })
  }

  // 2) ¿RECIÉN CRUZÓ EL ANILLO? Lo que ayer estaba adentro de su rango y hoy
  //    no, es lo único que de verdad es NOVEDAD en la pantalla.
  if (fz != null && Math.abs(fz) >= UMBRAL_CANDENTE
      && s.fuerzaAyer != null && Math.abs(s.fuerzaAyer) < UMBRAL_CANDENTE) {
    marcas.push({
      id: 'nueva',
      icono: '🆕',
      corto: 'cruzó hoy',
      texto: `Ayer esta misma ventana iba ${pct(s.retornoAyer)} — todavía dentro de su rango. Cruzó el anillo con el cierre de hoy.`,
    })
  }

  // 3) EL TECHO Y EL PISO DEL AÑO. No es teoría: son precios a los que esta
  //    misma acción ya llegó en los últimos 12 meses.
  const r52 = f.rango52
  if (r52) {
    if (r52.desdeMax >= 0) {
      // max52 se calcula cuando corre el robot; si el precio de hoy lo pasó,
      // es que acaba de hacer un máximo nuevo.
      marcas.push({
        id: 'techo', icono: '🔺', corto: 'máximo de 12 meses',
        texto: `${f.moneda} ${f.precio} es el precio más alto al que llegó en los últimos 12 meses: pasó su techo anterior (${f.moneda} ${r52.max}).`,
      })
    } else if (r52.desdeMax >= -1.5) {
      marcas.push({
        id: 'techo', icono: '🔺', corto: 'techo del año',
        texto: `${f.moneda} ${f.precio} está a ${Math.abs(r52.desdeMax).toFixed(1)}% de su precio más alto de los últimos 12 meses (${f.moneda} ${r52.max}).`,
      })
    } else if (r52.sobreMin <= 1.5) {
      marcas.push({
        id: 'piso', icono: '🔻', corto: 'piso del año',
        texto: `${f.moneda} ${f.precio} está a ${Math.abs(r52.sobreMin).toFixed(1)}% de su precio más bajo de los últimos 12 meses (${f.moneda} ${r52.min}).`,
      })
    }
  }

  // 4) EL GIRO: venía para un lado y se dio vuelta. Se piden DOS ventanas de
  //    verdad (cada una fuera de su vaivén) para no llamar "giro" al ruido de
  //    dos semanas planas.
  if (s.previo != null && Math.abs(s.previo) >= normal && Math.abs(ret) >= normal
      && Math.sign(s.previo) !== Math.sign(ret)) {
    marcas.push({
      id: 'giro', icono: '🔄', corto: 'se dio vuelta',
      texto: `La ventana anterior había hecho ${pct(s.previo)} y esta va ${pct(ret)}: cambió de dirección, no siguió de largo.`,
    })
  }

  // 5) ¿TENDENCIA O UN SOLO DÍA? Si el grueso pasó en una rueda, esa fecha es
  //    la que hay que ir a buscar en los titulares — y no la de hoy.
  // 3.5× lo que pesa una rueda cualquiera del plazo — el corte cae cerca del
  // 10% de los contactos en los cinco plazos, que es lo que uno espera de
  // algo que se llama «excepcional». Se pide además que la acción SE HAYA
  // MOVIDO y que ese día empujara en la misma dirección: en una ventana que
  // terminó plana, «fue un día» no explica nada.
  const c = s.concentracion
  if (c && c.veces >= 3.5 && Math.abs(ret) >= normal && Math.sign(c.pct) === Math.sign(ret)) {
    marcas.push({
      id: 'undia', icono: '⚡', corto: 'fue un día',
      texto: `El ${c.fecha} hizo ${pct(c.pct)} — esa sola rueda pesó ${c.veces.toFixed(1)}× lo que pesa una rueda cualquiera de este plazo. El movimiento tiene fecha.`,
    })
  }

  // 6) ¿SOLA O EN GRUPO? Un +8% con todo su sector en +7% no es una historia
  //    de la empresa; es una historia del cobre, del acero o de la tasa.
  if (s.medianaSector != null && Math.abs(ret) >= normal) {
    const sec = s.medianaSector
    if (Math.abs(sec) < normal * 0.5) {
      marcas.push({
        id: 'sola', icono: '🧍', corto: 'se movió sola',
        texto: `Su sector quedó en ${pct(sec)} y ella hizo ${pct(ret)}: el movimiento es de la empresa, no del sector.`,
      })
    } else if (Math.sign(sec) === Math.sign(ret) && Math.abs(sec) >= normal * 0.7) {
      marcas.push({
        id: 'arrastre', icono: '🌊', corto: 'la arrastró el sector',
        texto: `Todo su sector se movió (${pct(sec)}): esto se parece más a algo del rubro que a algo de la empresa.`,
      })
    } else if (Math.sign(sec) !== Math.sign(ret) && Math.abs(sec) >= normal * 0.5) {
      marcas.push({
        id: 'contra', icono: '🔀', corto: 'contra su sector',
        texto: `Su sector fue ${pct(sec)} y ella ${pct(ret)}: se movió al revés que sus pares.`,
      })
    }
  }

  // 7) LA RACHA: cuatro ruedas seguidas ya no es casualidad de un día.
  if (f.racha && f.racha.dias >= 4) {
    marcas.push({
      id: 'racha', icono: f.racha.sube ? '📈' : '📉',
      corto: `${f.racha.dias} ruedas ${f.racha.sube ? 'subiendo' : 'bajando'}`,
      texto: `Lleva ${f.racha.dias} ruedas seguidas cerrando ${f.racha.sube ? 'arriba' : 'abajo'} (sin contar las que no negoció).`,
    })
  }

  // 8) LA LIQUIDEZ, al final y en tono de aviso: pasó el filtro de "se
  //    negocia", pero se negocia poco, y a precios así se entra fácil y se
  //    sale caro.
  if (f.liquidezPct != null && f.liquidezPct < 60) {
    marcas.push({
      id: 'seca', icono: '💧', corto: 'negocia poco',
      texto: `Cambió de precio en ${f.liquidezPct.toFixed(0)}% de las ruedas del año: con tan poco movimiento, cada operación pesa más en el precio.`,
    })
  }

  return marcas
}

// ── LOS RASTREOS: para qué se enciende el sonar ───────────────────────────
// El plato con 32 contactos siempre muestra lo mismo. Estos filtros son las
// preguntas concretas con las que alguien se sienta a mirarlo. Cada uno se
// apoya en una marca de la firma — no hay ninguno que invente un criterio
// nuevo que no esté explicado arriba.
export const RASTREOS = [
  { id: 'todo', icono: '📡', etiqueta: 'todo el plato',
    ayuda: 'Todos los contactos, ordenados por cuánto se salieron de su rango.',
    prueba: () => true },
  { id: 'anillo', icono: '🔥', etiqueta: 'fuera de rango',
    ayuda: 'Se movieron más de lo que ellas mismas suelen moverse.',
    prueba: (c) => c.anomalia },
  { id: 'nueva', icono: '🆕', etiqueta: 'cruzaron hoy',
    ayuda: 'Ayer todavía estaban dentro de su rango. Es lo único nuevo de la pantalla.',
    prueba: (c) => c.marcas.has('nueva') },
  { id: 'giro', icono: '🔄', etiqueta: 'se dieron vuelta',
    ayuda: 'Venían para un lado y cambiaron de dirección.',
    prueba: (c) => c.marcas.has('giro') },
  { id: 'sola', icono: '🧍', etiqueta: 'se movieron solas',
    ayuda: 'Su sector se quedó quieto: la historia es de la empresa.',
    prueba: (c) => c.marcas.has('sola') || c.marcas.has('contra') },
  { id: 'techo', icono: '🔺', etiqueta: 'techo o piso del año',
    ayuda: 'Están pegadas al precio más alto (o más bajo) de sus últimos 12 meses.',
    prueba: (c) => c.marcas.has('techo') || c.marcas.has('piso') },
  { id: 'undia', icono: '⚡', etiqueta: 'fue un solo día',
    ayuda: 'Casi todo el recorrido pasó en una sola rueda: hay una fecha que buscar.',
    prueba: (c) => c.marcas.has('undia') },
]
