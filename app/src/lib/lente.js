import lentesData from '../data/lentes.json'

// ─────────────────────────────────────────────────────────────────────────
// 🔍 EL LENTE — "antes de juzgar un número, declara con qué ojo lo lees".
// Nace del plan educativo (mejora #21): la MISMA deuda es peligro en una
// minera, normal en una eléctrica, manejable en un hospital y un ERROR DE
// CATEGORÍA en un banco. El lente hereda del sector (empresas.json) y lo
// refina por ticker (lentes.json) — el sector NO se toca: Explorar, el quiz
// y los escenarios siguen funcionando igual.
// ─────────────────────────────────────────────────────────────────────────

export function claveLente(empresa) {
  if (!empresa) return 'industrial'
  return (
    lentesData.porTicker?.[empresa.ticker] ||
    lentesData.porSector?.[empresa.sector] ||
    'industrial'
  )
}

// El objeto completo del lente (nombre, icono, cómo se lee su deuda, caso…)
export function lenteDe(empresa) {
  const clave = claveLente(empresa)
  const l = lentesData.lentes?.[clave]
  return l ? { clave, ...l } : null
}

// ¿Su caja depende de un precio que sube y baja? (mineras, pesqueras, agro…)
export function esCiclico(empresa) {
  return lenteDe(empresa)?.flujo === 'ciclico'
}

// ─────────────────────────────────────────────────────────────────────────
// 💳 ¿PUEDE PAGAR SU DEUDA? (mejora #41)
// Deuda neta ÷ ganancia operativa anual = los AÑOS de caja que tardaría en
// pagarla. Mismos datos verificados que ya usa Valoracion.jsx (evEbitdaRaw
// del XBRL de la SMV): deuda financiera, efectivo, utilidad operativa y —
// cuando la empresa la publica — la depreciación (D&A).
// El VEREDICTO depende del lente: 3 años son cómodos para un hospital o una
// eléctrica y una alerta para una minera (su caja se juzga con el metal
// BARATO, no con el metal caro de hoy).
// Regla de Oro #1: si el dato no está, se dice — no se estima.
// Devuelve:
//   { aplica:false, lente }                         · banco/seguro/AFP/fondo
//   { sinDato:true, motivo }                        · faltan datos en la SMV
//   { anios, estado, deudaNeta, ganancia, sinDya }  · el cálculo
//   { cajaNeta:true, sobra }                        · tiene más caja que deuda
// ─────────────────────────────────────────────────────────────────────────
export function deudaInfo(empresa) {
  const l = lenteDe(empresa)
  if (!l) return null
  if (l.deudaAplica === false) return { aplica: false, lente: l }

  const sim = empresa.monedaEstados === 'USD' ? 'US$' : 'S/'

  // Caso especial: empresas que no presentan estados individuales a la SMV
  // (reportan consolidado afuera). Se usa SU cifra, siempre con fecha.
  const man = lentesData.deudaManual?.[empresa.ticker]
  if (man) {
    return {
      aplica: true, lente: l, manual: man, anios: man.anios,
      estado: estadoPorAnios(man.anios, l.flujo), sim,
    }
  }

  const r = empresa.evEbitdaRaw
  if (!r || r.utilidadOperativa == null) {
    return { aplica: true, lente: l, sinDato: true, sim, motivo: 'la SMV no publica su ganancia operativa en el archivo estructurado' }
  }
  if (r.deudaFinanciera == null) {
    return { aplica: true, lente: l, sinDato: true, sim, motivo: 'no figura su deuda financiera en el archivo estructurado de la SMV' }
  }

  const deudaNeta = (r.deudaFinanciera || 0) - (r.efectivo || 0)
  const sinDya = r.dya == null
  // Trimestral × 4 — el mismo anualizado que usa "la empresa entera" en Valoracion.
  const ganancia = (r.utilidadOperativa + (r.dya || 0)) * 4

  if (deudaNeta <= 0) {
    return { aplica: true, lente: l, cajaNeta: true, sobra: -deudaNeta, sim, ganancia, sinDya }
  }
  if (ganancia <= 0) {
    return {
      aplica: true, lente: l, sinGanancia: true, deudaNeta, sim,
      motivo: 'hoy no genera ganancia operativa: no hay con qué dividir la deuda',
    }
  }

  const anios = deudaNeta / ganancia
  // 🔒 Sin la depreciación (58 de 115 empresas la presentan resumida y no la
  // taguean), la ganancia usada es MENOR que la real → los años salen de más.
  // O sea: el número es un TECHO. Eso permite una conclusión honesta y otra
  // que no lo es: si hasta el techo es cómodo, es cómodo de verdad; pero si
  // el techo pinta feo NO se puede afirmar que la deuda sea pesada — el
  // número real podría ser bastante mejor. En ese caso no damos veredicto
  // (Regla de Oro #1: mejor decir "no se puede afirmar" que afirmar de más).
  const bruto = estadoPorAnios(anios, l.flujo)
  const estado = sinDya && bruto !== 'verde' ? 'incierto' : bruto
  const info = { aplica: true, lente: l, anios, estado, techo: sinDya, deudaNeta, ganancia, sinDya, sim }
  // 🌀 La prueba del FONDO DEL CICLO: en una minera, una pesquera o una
  // azucarera, la caja de hoy es la del commodity caro. La misma deuda con
  // la ganancia a la MITAD es el número que de verdad hay que mirar — y
  // convierte el aviso de "ojo, es cíclica" en una resta concreta.
  if (l.flujo === 'ciclico' && estado !== 'incierto') {
    info.aniosEstres = anios * 2
    info.estadoEstres = estadoPorAnios(info.aniosEstres, l.flujo)
  }
  return info
}

function estadoPorAnios(anios, flujo) {
  const u = lentesData.umbrales?.[flujo] || lentesData.umbrales.intermedio
  if (anios < u.verde) return 'verde'
  if (anios < u.ambar) return 'ambar'
  return 'rojo'
}

// Los umbrales del lente en texto ("cómodo hasta 2 años · vigilar hasta 4")
export function umbralesDe(empresa) {
  const l = lenteDe(empresa)
  if (!l || l.deudaAplica === false) return null
  return lentesData.umbrales?.[l.flujo] || lentesData.umbrales.intermedio
}

// Veredicto en palabras para el globo de la radiografía y la tarjeta.
export const PALABRA_DEUDA = {
  verde: { corto: 'Deuda cómoda', tono: 'bien' },
  ambar: { corto: 'Deuda a vigilar', tono: 'neutro' },
  rojo: { corto: 'Deuda pesada', tono: 'mal' },
  incierto: { corto: 'No se puede afirmar', tono: 'neutro' },
}

// Los años en palabras. Más allá de ~15 la precisión decimal es humo
// (el trimestre × 4 manda), así que se dice "más de 15 años" y punto.
export function aniosTexto(anios) {
  if (anios > 15) return 'más de 15 años'
  // Por debajo de medio año el decimal es ruido ("0.0 años" no se dice).
  if (anios < 0.6) return 'menos de un año'
  return `${anios.toFixed(1)} años`
}
