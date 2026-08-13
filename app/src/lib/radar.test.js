import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { conCola, conUltimoPrecio, crudaDe, metaDe, serieDe } from './series'
import { PLAZOS, filasRadar, firmaDe, noticiasConEfecto, retornoOffset } from './radar'
import { precioDe } from './finanzas'
import { hechosDe } from './hechos'
import { empresaDe, filasDe } from './cartera'

// ═════════════════════════════════════════════════════════════════════════
// Las pruebas que fijan los INVARIANTES numéricos del Radar.
//
// POR QUÉ EXISTEN. Los invariantes vivían solo en prosa (INVARIANTES.md), y
// dos revisiones externas propusieron cambios destructivos sin poder notarlo:
// leer un documento no falla, un test sí. El criterio para escribir uno acá es
// estrecho a propósito — se prueba lo que, al romperse, produce NÚMEROS
// PLAUSIBLES que nadie notaría mirando la pantalla. Nada de formatos, textos
// ni iconos: eso cambia mucho más seguido que la aritmética.
// ═════════════════════════════════════════════════════════════════════════

const px = (precio, sesion) => ({ precio, ultimaOperacion: `${sesion}T14:30:00-05:00` })

describe('la puerta única sigue siendo única (INVARIANTES #26)', () => {
  // No prueba un cálculo: prueba que nadie deshaga la decisión. Un `import
  // historicos.json` nuevo en cualquier archivo reabre la clase entera de bugs
  // que la puerta cerró, y lo haría en silencio — el gráfico se vería igual.
  const raiz = join(import.meta.dirname, '..')

  const archivos = (dir) => readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return n === 'data' ? [] : archivos(ruta)
    return /\.(js|jsx)$/.test(n) ? [ruta] : []
  })

  it('solo lib/series.js importa historicos.json', () => {
    const culpables = archivos(raiz).filter((ruta) => {
      if (ruta.endsWith(join('lib', 'series.js'))) return false
      return /import\s+\w+\s+from\s+['"].*data\/historicos\.json['"]/.test(
        readFileSync(ruta, 'utf8'),
      )
    })
    expect(culpables.map((r) => r.replace(raiz, ''))).toEqual([])
  })

  it('solo lib/hechos.js importa hechos.json', () => {
    // Mismo candado que el histórico, y por el mismo motivo: los Hechos tienen
    // una versión viva que la app baja cada 45 s. Quien lea el archivo por su
    // cuenta vuelve a mostrar una frescura distinta a la del Sonar.
    const culpables = archivos(raiz).filter((ruta) => {
      if (ruta.endsWith(join('lib', 'hechos.js'))) return false
      return /import\s+\w+\s+from\s+['"].*data\/hechos\.json['"]/.test(readFileSync(ruta, 'utf8'))
    })
    expect(culpables.map((r) => r.replace(raiz, ''))).toEqual([])
  })

  it('la puerta no tiene reloj: nada de `new Date()` sin argumentos', () => {
    // El determinismo de la puerta es su propiedad más valiosa ahora que es el
    // único punto de entrada a las series. Un reloj adentro lo rompe de una
    // forma que ninguna prueba de resultado detecta: pasa hoy y falla en marzo.
    const fuente = readFileSync(join(raiz, 'lib', 'series.js'), 'utf8')
    expect(fuente).not.toMatch(/new Date\(\s*\)|Date\.now\(\s*\)/)
  })

  it('ningún componente hace fetch: la red vive en lib/vivo.js', () => {
    // Un `fetch` dentro de un .jsx se dispara en cada repintado. La capa viva
    // tiene backoff, corte con la pestaña de fondo y horario de rueda; un
    // componente que pida por su cuenta no tiene nada de eso.
    const culpables = archivos(join(raiz, 'components'))
      .filter((ruta) => /\bfetch\s*\(|from\s+['"]axios['"]/.test(readFileSync(ruta, 'utf8')))
    expect(culpables.map((r) => r.replace(raiz, ''))).toEqual([])
  })
})

describe('conUltimoPrecio — las tres ramas (INVARIANTES #21)', () => {
  const base = [['2026-07-29', 10], ['2026-07-30', 11]]

  it('sesión POSTERIOR: agrega la rueda de hoy', () => {
    const r = conUltimoPrecio(base, px(12, '2026-07-31'))
    expect(r).toHaveLength(3)
    expect(r[2]).toEqual(['2026-07-31', 12])
  })

  it('sesión IGUAL: reemplaza, no duplica', () => {
    const r = conUltimoPrecio(base, px(11.5, '2026-07-30'))
    expect(r).toHaveLength(2)
    expect(r[1]).toEqual(['2026-07-30', 11.5])
    // Si esta rama se rompiera y agregara en vez de reemplazar, la serie
    // tendría dos veces el mismo día y el retorno de 1 rueda daría 0.00%:
    // un número perfectamente plausible, y falso.
    const ultimoRetorno = (r[r.length - 1][1] / r[r.length - 2][1] - 1) * 100
    expect(ultimoRetorno).toBeCloseTo(15, 5)
  })

  it('sesión ANTERIOR: no toca nada — a la que no negoció no se le inventa un día', () => {
    // La BVL repite el último cierre de la acción que no operó. Estamparlo
    // como si fuera de hoy fabricaría una rueda que no existió.
    expect(conUltimoPrecio(base, px(11, '2026-07-24'))).toBe(base)
  })

  it('sin precio válido no se toca la serie', () => {
    expect(conUltimoPrecio(base, { precio: 0, fecha: '2026-07-31' })).toBe(base)
    expect(conUltimoPrecio(base, null)).toBe(base)
  })
})

describe('hechosDe — la puerta de los Hechos (5.º bug)', () => {
  const HORNEADO = {
    fecha: '2026-07-31', titulo: 'Información Financiera Intermedia', pdf: 'https://x/a.pdf',
  }
  const VIVO_NUEVO = { fecha: '2026-08-04', titulo: 'Compra de activos', hora: '07:08', envivo: true }

  it('el Hecho que solo existe en vivo entra, y encabeza', () => {
    const r = hechosDe('__prueba__', { __prueba__: [VIVO_NUEVO] })
    expect(r[0]).toEqual(VIVO_NUEVO)
  })

  it('el mismo Hecho por los dos caminos NO se duplica, aunque el vivo no traiga PDF', () => {
    // La trampa de este archivo: el vivo puede llegar sin documento y el
    // horneado traerlo. Con el PDF de clave serían dos, y el usuario vería su
    // Hecho repetido. La clave es fecha + texto.
    //
    // Se prueba contra un Hecho REAL del archivo: con un ticker inventado la
    // lista horneada está vacía y no hay nada contra qué deduplicar.
    const { filas } = filasRadar(null, null, null, '2026-08-04')
    const f = filas.find((x) => hechosDe(x.ticker).length > 1)
    const real = hechosDe(f.ticker)[0]
    const vivoSinPdf = { fecha: real.fecha, titulo: real.titulo, categoria: real.categoria, hora: '11:56' }
    const r = hechosDe(f.ticker, { [f.ticker]: [vivoSinPdf] })
    expect(r).toHaveLength(hechosDe(f.ticker).length)
    expect(r.filter((h) => h.fecha === real.fecha
      && (h.titulo || h.categoria) === (real.titulo || real.categoria))).toHaveLength(1)
    // y el que queda es el vivo, que es el que trae la hora
    expect(r[0].hora).toBe('11:56')
  })

  it('sin capa viva devuelve exactamente lo del archivo', () => {
    const { filas } = filasRadar(null, null, null, '2026-08-04')
    const conHechos = filas.find((f) => hechosDe(f.ticker).length > 1)
    expect(hechosDe(conHechos.ticker, null)).toEqual(hechosDe(conHechos.ticker))
    expect(hechosDe(conHechos.ticker, {})).toEqual(hechosDe(conHechos.ticker))
  })

  it('la lista queda ordenada del más nuevo al más viejo', () => {
    const { filas } = filasRadar(null, null, null, '2026-08-04')
    for (const f of filas.slice(0, 10)) {
      const r = hechosDe(f.ticker, { [f.ticker]: [VIVO_NUEVO] })
      for (let i = 1; i < r.length; i++) expect(r[i - 1].fecha >= r[i].fecha).toBe(true)
    }
  })
})

describe('filasDe — la valorización del Cuaderno usa el precio vivo', () => {
  // El ticker sale del propio archivo para no clavar un nombre que mañana
  // podría no estar.
  const { filas: radar } = filasRadar(null, null, null, '2026-08-04')
  const tk = radar.find((f) => (f.moneda || '').includes('S/')).ticker
  const cartera = [{ t: tk, cant: 100, costo: 1 }]

  it('sin capa viva valoriza con el precio horneado', () => {
    const { filas } = filasDe(cartera)
    expect(filas[0].e.precio).toBe(precioDe(tk).precio)
  })

  it('con capa viva valoriza con el precio del mercado, no con el del archivo', () => {
    // Es el bug que se está cerrando: el Radar en vivo y la plata del usuario
    // anclada al último despliegue.
    const otro = precioDe(tk).precio * 2
    const { filas, totalValor } = filasDe(cartera, { [tk]: { precio: otro, moneda: 'S/', envivo: true } })
    expect(filas[0].e.precio).toBe(otro)
    expect(totalValor).toBeCloseTo(otro * 100, 6)
  })

  it('el caché de la empresa no puede devolver el precio viejo', () => {
    // El caché de módulo guardaba la empresa entera, precio incluido: la
    // segunda llamada devolvía el objeto de la primera y el número se quedaba
    // quieto para siempre.
    const a = empresaDe(tk, { precio: 111, moneda: 'S/' })
    const b = empresaDe(tk, { precio: 222, moneda: 'S/' })
    expect(a.precio).toBe(111)
    expect(b.precio).toBe(222)
    expect(b.nombre).toBe(a.nombre) // lo que no cambia, se sigue cacheando
  })

  it('sin precio no se inventa cotización: se valoriza al costo', () => {
    // Regla vieja que el arreglo no puede pisar — las que casi no negocian se
    // valorizan a lo que pagó el usuario, y se dice.
    const { filas } = filasDe([{ t: tk, cant: 10, costo: 7 }], { [tk]: { precio: null } })
    expect(filas[0].e.sinPrecio).toBe(true)
    expect(filas[0].e.precio).toBe(7)
  })
})

describe('retornoOffset — la ventana no se corre un puesto', () => {
  // 21 cierres: uno por rueda, todos iguales salvo un salto puesto a mano.
  const serie = Array.from({ length: 21 }, (_, i) => [`d${String(i).padStart(2, '0')}`, 100])
  serie[20][1] = 110 // la última rueda hace +10%

  it('mide exactamente `ruedas` sesiones hacia atrás', () => {
    expect(retornoOffset(serie, 1)).toBeCloseTo(10, 6)   // solo la última
    expect(retornoOffset(serie, 20)).toBeCloseTo(10, 6)  // toda la ventana
  })

  it('`atras` desplaza la ventana entera, sin contaminarse con la de hoy', () => {
    // La misma ventana vista ayer: el salto de la última rueda queda fuera.
    expect(retornoOffset(serie, 1, 1)).toBeCloseTo(0, 6)
    expect(retornoOffset(serie, 5, 1)).toBeCloseTo(0, 6)
  })

  it('sin historia suficiente devuelve null, no un número inventado', () => {
    expect(retornoOffset(serie, 25)).toBeNull()
    expect(retornoOffset(serie, 20, 5)).toBeNull()
  })
})

describe('conCola — las ruedas que el robot no alcanzó a guardar', () => {
  const base = [['2026-07-29', 10], ['2026-07-30', 11]]

  it('pega solo las fechas POSTERIORES a la última guardada', () => {
    const r = conCola(base, [['2026-07-30', 99], ['2026-07-31', 12], ['2026-08-03', 13]])
    expect(r.map(([f]) => f)).toEqual(['2026-07-29', '2026-07-30', '2026-07-31', '2026-08-03'])
    // el cierre ya guardado del 30 NO se reescribe con el 99 de la cola
    expect(r[1][1]).toBe(11)
  })
})

describe('serieDe — la puerta única (Bug 1 y Sparkline)', () => {
  it('repara con las DOS patas: la cola y el precio de hoy', () => {
    // El caso real del 04-ago-2026: el archivo llegaba al 30-jul, la cola traía
    // las ruedas cerradas del 31-jul y 1-ago, y el precio era del 3-ago.
    const cruda = [['2026-07-29', 10], ['2026-07-30', 11]]
    const conAmbas = conUltimoPrecio(
      conCola(cruda, [['2026-07-31', 12], ['2026-08-03', 13]]),
      px(14, '2026-08-04'),
    )
    expect(conAmbas.map(([f]) => f)).toEqual(
      ['2026-07-29', '2026-07-30', '2026-07-31', '2026-08-03', '2026-08-04'],
    )
    // Reparar SOLO con el precio de hoy —saltándose la cola— deja el hueco en
    // el medio y la ventana sigue midiendo desde una fecha vieja.
    expect(conUltimoPrecio(cruda, px(14, '2026-08-04'))).toHaveLength(3)
  })

  it('sin argumentos repara con precios.json: nunca termina antes que el precio', () => {
    // Es el arreglo del Sparkline: cualquier módulo, sin red y sin hooks,
    // obtiene una serie que llega hasta donde llega el precio horneado.
    const { filas } = filasRadar(null, null, null, '2026-08-04')
    for (const f of filas.slice(0, 10)) {
      const serie = serieDe(f.ticker)
      expect(serie.length).toBeGreaterThan(0)
      expect(serie[serie.length - 1][0]).toBe(f.fechaCierre)
    }
  })
})

describe('noticiasConEfecto — mide contra la serie reparada (Bug 1)', () => {
  it('el % desde el titular sale del ÚLTIMO precio de la serie que se le pasa', () => {
    // Serie reparada: termina en 0.85 (3-ago). El archivo crudo terminaba en
    // 0.795 (30-jul), y de ahí salía otro número para el mismo titular — 6.9
    // puntos de diferencia, medidos el 04-ago-2026 en VOLCABC1.
    const serie = [
      ['2026-07-20', 0.80], ['2026-07-30', 0.795], ['2026-08-03', 0.85],
    ]
    const cierre = new Map(serie)
    const { filas } = filasRadar(null, null, null, '2026-08-04')
    const conNotas = filas.map((f) => [f.ticker, noticiasConEfecto(f.ticker, 20, serie)])
      .find(([, ns]) => ns.some((n) => n.baseFecha))
    expect(conNotas).toBeDefined() // si no, es que no hay prensa guardada
    for (const n of conNotas[1]) {
      if (!n.baseFecha) continue
      expect(n.desdeElTitular).toBeCloseTo((0.85 / cierre.get(n.baseFecha) - 1) * 100, 6)
    }
  })

  it('un titular anterior a la serie NO produce NaN ni Infinity', () => {
    // Empresa recién listada, o serie recortada: no hay cierre del día del
    // titular contra el cual medir. React renderiza un NaN como texto vacío y
    // el fallo pasa desapercibido.
    const corta = [['2026-08-03', 1.5], ['2026-08-04', 1.6]]
    const { filas } = filasRadar(null, null, null, '2026-08-04')
    for (const f of filas.slice(0, 15)) {
      for (const n of noticiasConEfecto(f.ticker, 20, corta)) {
        if (n.fecha >= corta[0][0]) continue // ese sí tiene contra qué medirse
        expect(n.desdeElTitular).toBeNull()
        expect(n.baseFecha).toBeNull()
      }
    }
  })

  it('sin serie no inventa: devuelve vacío en vez de caer al archivo', () => {
    // El default que caía al histórico crudo traía el bug de vuelta en
    // silencio el día que un llamador olvidara el argumento.
    expect(noticiasConEfecto('VOLCABC1', 20, undefined)).toEqual([])
    expect(noticiasConEfecto('VOLCABC1', 20, [])).toEqual([])
  })
})

describe('filasRadar — el filtro y el Hecho de Importancia', () => {
  const { filas, descartadas, total } = filasRadar(null, null, null, '2026-08-04')

  it('deja fuera a las pocoNegociada (INVARIANTES #20)', () => {
    expect(filas.length).toBeGreaterThan(0)
    expect(descartadas).toBeGreaterThan(0)
    expect(filas.length + descartadas).toBeLessThanOrEqual(total)
    // Ninguna fila puede venir de una acción con el precio congelado: sin este
    // filtro GRHOLDC1 aparecía con +674% en 20 días habiendo cambiado de
    // precio 2 veces en el mes.
    for (const f of filas) expect(metaDe(f.ticker).pocoNegociada).toBeFalsy()
  })

  it('devuelve la serie reparada de cada fila para medir los titulares', () => {
    const { filas: fs, series } = filasRadar(null, null, null, '2026-08-04')
    expect(series.size).toBe(fs.length)
    const f = fs[0]
    // La misma serie de la que sale el % de la ficha: la gráfica y el número
    // no se pueden contradecir (INVARIANTES #25).
    expect(series.get(f.ticker).slice(-24)).toEqual(f.serie)
  })

  it('el precio de la ficha ES el último punto de la serie', () => {
    // El gráfico y el número que tiene al lado no pueden venir de sitios
    // distintos: fue el bug del Sparkline y el del «desde el titular».
    for (const f of filas) {
      expect(f.serie[f.serie.length - 1][1]).toBe(f.precio)
      expect(f.serie[f.serie.length - 1][0]).toBe(f.fechaCierre)
    }
  })

  it('la serie reparada NUNCA es más corta que la del archivo', () => {
    // Reparar solo puede agregar o reemplazar la última rueda. Si una
    // optimización futura se comiera dos ruedas, el gráfico se seguiría viendo
    // perfecto y las ventanas medirían otra cosa.
    for (const f of filas) {
      expect(serieDe(f.ticker).length).toBeGreaterThanOrEqual(crudaDe(f.ticker).length)
    }
  })

  it('la puerta es determinista: mismas entradas, misma secuencia', () => {
    // Como es el único punto de entrada a las series, que dos llamadas puedan
    // diferir —por un caché, por el orden de las llamadas o por la hora— haría
    // dudar de todas las pantallas a la vez.
    const cola = { X: [['2026-08-05', 9]] }
    const px = { precio: 9.5, ultimaOperacion: '2026-08-06T14:00:00-05:00' }
    for (const f of filas.slice(0, 5)) {
      expect(serieDe(f.ticker)).toEqual(serieDe(f.ticker))
      expect(serieDe(f.ticker, { cola: cola.X, px })).toEqual(
        serieDe(f.ticker, { cola: cola.X, px }),
      )
    }
  })

  it('la edad del HI no cambia si el «hoy» viene con hora (huso de Lima)', () => {
    // A las 23:55 de Lima, un instante completo son 28h55m contra la
    // medianoche UTC del día del Hecho: redondeaba a 1 y decía «hace 1 día» de
    // algo publicado hoy.
    const soloFecha = filasRadar(null, null, null, '2026-08-04')
    const conHora = filasRadar(null, null, null, '2026-08-04T23:55:00-05:00')
    for (let i = 0; i < soloFecha.filas.length; i++) {
      expect(conHora.filas[i].hecho?.dias ?? null).toBe(soloFecha.filas[i].hecho?.dias ?? null)
    }
  })

  it('el dividendo se marca cuando la fecha ex cae dentro de la ventana', () => {
    // Es la única marca de la firma que le QUITA valor al movimiento: una
    // acción que cae 4% el día que pagó no se movió, se le descontó la plata
    // que repartió. Si esta marca dejara de salir, el Sonar volvería a señalar
    // como anomalía algo que es pura aritmética del calendario — y el % de
    // caída seguiría siendo correcto, así que nada en pantalla se vería roto.
    const marcas = new Set()
    for (const f of filas) {
      for (const p of PLAZOS) for (const m of firmaDe(f, p.ruedas)) marcas.add(m.id)
    }
    expect(marcas.has('dividendo') || marcas.has('exdiv')).toBe(true)
  })

  it('lo que muestra el Radar coincide con lo que muestra la ficha', () => {
    // Mismo concepto en dos pantallas, un solo origen. Es la propiedad, no el
    // componente: si alguna vez divergen, da igual cuál de los dos «acertó».
    for (const f of filas) {
      expect(f.precio).toBe(precioDe(f.ticker)?.precio ?? f.precio)
    }
  })

  it('un HI posterior al último cierre NO desaparece (Bug 2)', () => {
    // Se mide la edad contra el calendario, no contra la última rueda. Con un
    // "hoy" muy posterior, todo Hecho guardado tiene días >= 0 y sigue vivo.
    const { filas: fs } = filasRadar(null, null, null, '2030-01-01')
    const conHecho = fs.filter((f) => f.hecho)
    expect(conHecho.length).toBeGreaterThan(0)
    for (const f of conHecho) expect(f.hecho.dias).not.toBeNull()
  })
})
