import { describe, expect, it } from 'vitest'
import {
  CIERRE_BVL,
  diaPartido,
  esGemela,
  familiaDe,
  fueraDeRueda,
  horaDelHecho,
  marcasPatron,
  metalesDe,
  noticiaSinPagar,
  rsiDe,
  spreadGemela,
} from './patrones'

// ═════════════════════════════════════════════════════════════════════════
// Mismo criterio que radar.test.js: acá solo entra lo que, al romperse, deja
// NÚMEROS PLAUSIBLES en pantalla. Un spread con el tipo de cambio invertido
// (2.43 contra 3.39 en vez de contra 2.54) se ve igual de razonable y dice lo
// contrario; un RSI que no es el de Wilder se parece al de cualquier otra
// pantalla hasta que alguien compara. Eso es lo que se fija.
// ═════════════════════════════════════════════════════════════════════════

const serie = (cierres) => cierres.map((v, i) => [`2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, '0')}`, v])

describe('RSI de Wilder', () => {
  it('una serie que solo sube da 100 y una que solo baja da 0', () => {
    const sube = serie(Array.from({ length: 30 }, (_, i) => 10 + i))
    const baja = serie(Array.from({ length: 30 }, (_, i) => 40 - i))
    expect(rsiDe(sube)).toBe(100)
    expect(rsiDe(baja)).toBe(0)
  })

  it('un diente de sierra se queda alrededor de la mitad', () => {
    // Sube 1 y baja 1, alternado: ninguna dirección manda, así que el RSI se
    // queda pegado a 50. No cae EXACTO en 50 y eso es correcto — la última
    // rueda pesa 1/14 más que las otras, así que inclina un par de puntos
    // según cómo cerró. Lo que se fija es que no se vaya a una punta.
    for (const largo of [41, 42]) {
      const dientes = serie(Array.from({ length: largo }, (_, i) => 10 + (i % 2)))
      expect(rsiDe(dientes)).toBeGreaterThan(45)
      expect(rsiDe(dientes)).toBeLessThan(55)
    }
  })

  it('es el suavizado de Wilder, no una media simple', () => {
    // Un derrumbe al principio y veinte ruedas subiendo de a poco después.
    // Con media SIMPLE de las últimas 14 ruedas el derrumbe ya salió de la
    // ventana y el RSI da 100 —«no hubo una sola rueda roja»—; con Wilder
    // sigue pesando, decayendo, y da 53. Es la diferencia entre decir que el
    // tramo es perfecto y decir que está a la mitad.
    const s = serie([100, 80, ...Array.from({ length: 20 }, (_, i) => 81 + i)])
    expect(rsiDe(s)).toBeCloseTo(52.96, 2)
  })

  it('sin ruedas suficientes no inventa un número', () => {
    expect(rsiDe(serie([10, 11, 12]))).toBe(null)
    expect(rsiDe(null)).toBe(null)
  })
})

describe('la hora del Hecho de Importancia', () => {
  // El sello de tiempo real del Hecho con los resultados 2T26 de Nexa.
  const nexa = {
    fecha: '2026-08-05',
    categoria: 'Otros Hechos De Importancia',
    pdf: 'https://documents.bvl.com.pe/hhii/B20010/20260805201901/HI32EARNINGS32RELEASE32NEXA32RESOURCES322Q26.PDF',
  }

  it('la saca de la ruta del PDF cuando el Hecho horneado no trae hora', () => {
    expect(horaDelHecho(nexa)).toBe('20:19')
    expect(fueraDeRueda(nexa)).toEqual({ hora: '20:19', fuera: true })
  })

  it('la hora del Hecho vivo gana sobre la del PDF', () => {
    expect(horaDelHecho({ ...nexa, hora: '07:08' })).toBe('07:08')
    expect(fueraDeRueda({ ...nexa, hora: '07:08' })).toEqual({ hora: '07:08', fuera: false })
  })

  it('no le presta la hora de un PDF de otra fecha', () => {
    // La BVL sirve documentos viejos desde el mismo listado. Sin esta guarda,
    // un Hecho de hoy heredaría la hora de un PDF de la semana pasada y el
    // Sonar diría «fuera de rueda» sobre algo que sí se pudo operar.
    expect(horaDelHecho({ ...nexa, fecha: '2026-08-06' })).toBe(null)
  })

  it('sin hora por ningún lado no marca nada', () => {
    expect(horaDelHecho({ fecha: '2026-08-05', categoria: 'X' })).toBe(null)
    expect(fueraDeRueda({ fecha: '2026-08-05' })).toBe(null)
  })

  it('el corte es el cierre de la BVL', () => {
    expect(fueraDeRueda({ fecha: '2026-08-05', hora: CIERRE_BVL }).fuera).toBe(true)
    expect(fueraDeRueda({ fecha: '2026-08-05', hora: '14:59' }).fuera).toBe(false)
  })

  it('un Hecho de una sesión anterior ya tuvo su rueda para pagarse', () => {
    const vivos = { XX: [{ fecha: '2026-08-05', hora: '20:19', categoria: 'Resultados' }] }
    expect(noticiaSinPagar('XX', { vivos, hoyISO: '2026-08-05' })).toMatchObject({ hora: '20:19' })
    expect(noticiaSinPagar('XX', { vivos, hoyISO: '2026-08-06' })).toBe(null)
  })
})

describe('el metal de cada acción', () => {
  it('Volcan es mixta: vende zinc y plata', () => {
    // Es la razón de ser del mapa de segundo metal. El 7-ago-2026 subió 2.8%
    // con el zinc cayendo 1.7% y la plata subiendo 3.6%: clasificarla como
    // industrial a secas leía el día exactamente al revés.
    expect(metalesDe('VOLCABC1')).toEqual(['zinc', 'plata'])
    expect(familiaDe('VOLCABC1')).toBe('mixta')
  })

  it('las de un solo metal caen de un lado', () => {
    expect(familiaDe('RIO')).toBe('precioso')
    expect(familiaDe('CVERDEC1')).toBe('industrial')
  })

  it('la que no vive de un metal no entra al cálculo', () => {
    expect(familiaDe('LUSURC1')).toBe(null)
    expect(metalesDe('NOEXISTE')).toEqual([])
  })
})

describe('el día partido', () => {
  it('lo declara solo cuando las dos familias van en sentidos opuestos', () => {
    const d = diaPartido({
      RIO: 15.7, PODERC1: 2.1, BVN: 3.0, // preciosos
      CVERDEC1: -1.8, SPCCPI1: -2.2, MINSURI1: -0.9, // industriales
    })
    expect(d.partido).toBe(true)
    expect(d.manda).toBe('precioso')
    expect(d.preciosos).toBeCloseTo(3.0, 6)
    expect(d.industriales).toBeCloseTo(-1.8, 6)
  })

  it('con las dos familias del mismo lado no hay nada que contar', () => {
    const d = diaPartido({
      RIO: 2.0, PODERC1: 1.5, BVN: 1.8,
      CVERDEC1: 1.2, SPCCPI1: 0.9, MINSURI1: 1.1,
    })
    expect(d.partido).toBe(false)
    expect(d.manda).toBe(null)
  })

  it('un empate dentro del redondeo de la BVL no es un día partido', () => {
    const d = diaPartido({
      RIO: 0.1, PODERC1: 0.2, BVN: 0.15,
      CVERDEC1: -0.1, SPCCPI1: -0.05, MINSURI1: -0.2,
    })
    expect(d.partido).toBe(false)
  })

  it('sin tres acciones por familia no se calcula la mediana', () => {
    const d = diaPartido({ RIO: 15.7, CVERDEC1: -1.8, SPCCPI1: -2.2, MINSURI1: -0.9 })
    expect(d.partido).toBe(false)
    expect(d.preciosos).toBe(null)
    expect(d.cuantos).toEqual({ precioso: 1, industrial: 3 })
  })

  it('la mixta no vota en ninguna de las dos medianas', () => {
    // Volcan tiene un pie en cada familia: si votara, correría la mediana del
    // lado que se le asignara y el «día partido» se volvería circular.
    const sin = diaPartido({ RIO: 3, PODERC1: 3, BVN: 3, CVERDEC1: -1, SPCCPI1: -1, MINSURI1: -1 })
    const con = diaPartido({ RIO: 3, PODERC1: 3, BVN: 3, CVERDEC1: -1, SPCCPI1: -1, MINSURI1: -1, VOLCABC1: 99 })
    expect(con.preciosos).toBe(sin.preciosos)
    expect(con.industriales).toBe(sin.industriales)
  })
})

describe('la misma acción en dos bolsas', () => {
  // Cierre real del 7-ago-2026: RIO2 en Toronto C$ 3.54 y en Lima US$ 2.43,
  // con el dólar a 1.3941 dólares canadienses.
  const base = { precioLima: 2.43, monedaLima: 'USD', fuera: { precio: 3.54, moneda: 'CAD', fecha: '2026-08-07' } }

  it('trae el precio de Toronto a dólares y lo compara con Lima', () => {
    const s = spreadGemela('RIO', { ...base, fx: { 'USD/CAD': 1.3941 } })
    expect(s.paridad).toBeCloseTo(2.5393, 4)
    expect(s.diferenciaPct).toBeCloseTo(-4.303, 3)
  })

  it('da lo mismo si el tipo de cambio viene en el otro sentido', () => {
    // Es LA trampa de esta cuenta: con el par invertido salen 2.43 contra
    // 4.935 y un spread de −50.7%, que se ve tan plausible como el correcto.
    const directo = spreadGemela('RIO', { ...base, fx: { 'CAD/USD': 1 / 1.3941 } })
    const inverso = spreadGemela('RIO', { ...base, fx: { 'USD/CAD': 1.3941 } })
    expect(directo.paridad).toBeCloseTo(inverso.paridad, 6)
  })

  it('sin el precio de afuera devuelve null en vez de un spread viejo', () => {
    expect(spreadGemela('RIO', { precioLima: 2.43, monedaLima: 'USD', fx: { 'USD/CAD': 1.3941 } })).toBe(null)
    expect(spreadGemela('RIO', { ...base })).toBe(null) // sin tipo de cambio
  })

  it('una acción que solo cotiza en Lima no tiene gemela', () => {
    expect(esGemela('VOLCABC1')).toBe(false)
    expect(spreadGemela('VOLCABC1', { ...base, fx: { 'USD/CAD': 1.3941 } })).toBe(null)
  })

  it('misma moneda en las dos plazas no necesita tipo de cambio', () => {
    const s = spreadGemela('AUNA', {
      precioLima: 10, monedaLima: 'USD', fuera: { precio: 10.5, moneda: 'USD' },
    })
    expect(s.paridad).toBe(10.5)
    expect(s.diferenciaPct).toBeCloseTo(-4.76, 2)
  })
})

describe('las marcas', () => {
  it('cada marca lleva su número adentro y ninguna dice qué hacer', () => {
    const marcas = marcasPatron('RIO', {
      serie: serie(Array.from({ length: 30 }, (_, i) => 1 + i * 0.05)),
      dia: { partido: true, preciosos: 3.0, industriales: -1.8, manda: 'precioso' },
      noticia: { fecha: '2026-08-07', hora: '20:19' },
      spread: {
        bolsa: 'TSX (Toronto)', precioFuera: 3.54, monedaFuera: 'CAD',
        paridad: 2.5393, monedaLima: 'USD', diferenciaPct: -4.31,
      },
    })
    expect(marcas.map((m) => m.id)).toEqual(['metal', 'sinpagar', 'estirada', 'gemela'])
    for (const m of marcas) expect(m.texto).toMatch(/\d/)
    // La Regla de Oro, fijada: la app muestra, no recomienda. Se buscan los
    // verbos del consejo, no la raíz suelta — «esta vende oro» describe a la
    // empresa y tiene que poder decirse.
    const todo = marcas.map((m) => m.texto).join(' ').toLowerCase()
    expect(todo).not.toMatch(/\bcomprar|\bvender|deberías|hay que|conviene|recomend|oportunidad|apostar/)
  })

  it('sin patrón no hay marcas', () => {
    expect(marcasPatron('VOLCABC1', {})).toEqual([])
  })

  it('un spread por debajo del punto porcentual no se muestra', () => {
    const marcas = marcasPatron('RIO', {
      spread: { bolsa: 'TSX (Toronto)', precioFuera: 3.54, monedaFuera: 'CAD', paridad: 2.44, monedaLima: 'USD', diferenciaPct: -0.4 },
    })
    expect(marcas).toEqual([])
  })
})
