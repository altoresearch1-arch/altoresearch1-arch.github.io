// Lógica del quiz: determina perfil ganador y puntúa empresas.
// Reglas (del documento maestro):
//  - El PERFIL se decide por mayoría de votos en las preguntas de perfil.
//  - El SECTOR lo fija la pregunta de sector.
//  - Puntaje por empresa: +2 si coincide el sector, +2 si coincide el perfil.
//  - "Coincidencia alta" = coincide en ambos. "Parcial" = solo uno.
//  - Nunca queda vacío: si nada coincide, se devuelve lo mejor disponible.

export function calcularPerfil(respuestas, preguntas) {
  const conteo = {}
  let sector = null

  for (const preg of preguntas) {
    const elegido = respuestas[preg.id]
    if (elegido == null) continue
    const opcion = preg.opciones[elegido]
    if (!opcion) continue
    if (preg.tipo === 'sector') {
      sector = opcion.valor
    } else {
      conteo[opcion.valor] = (conteo[opcion.valor] || 0) + 1
    }
  }

  // perfil con más votos; desempate por orden de aparición estable
  let perfil = null
  let max = -1
  for (const [k, v] of Object.entries(conteo)) {
    if (v > max) {
      max = v
      perfil = k
    }
  }

  return { perfil, sector, conteo }
}

export function puntuarEmpresas(empresas, perfil, sector) {
  const puntuadas = empresas.map((e) => {
    const coincideSector = e.sector === sector
    const coincidePerfil = Array.isArray(e.perfiles) && e.perfiles.includes(perfil)
    let puntaje = 0
    if (coincideSector) puntaje += 2
    if (coincidePerfil) puntaje += 2

    let coincidencia = 'ninguna'
    if (coincideSector && coincidePerfil) coincidencia = 'alta'
    else if (coincideSector || coincidePerfil) coincidencia = 'parcial'

    return { empresa: e, puntaje, coincidencia, coincideSector, coincidePerfil }
  })

  // ordenar por puntaje desc; desempate alfabético por ticker para estabilidad
  puntuadas.sort((a, b) => {
    if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje
    return a.empresa.ticker.localeCompare(b.empresa.ticker)
  })

  return puntuadas
}

// Devuelve las 2-3 mejores. Nunca vacío: si las mejores tienen puntaje 0,
// igual se muestran (con coincidencia "ninguna") para no dejar pantalla vacía.
export function mejoresEmpresas(empresas, perfil, sector, n = 3) {
  const puntuadas = puntuarEmpresas(empresas, perfil, sector)
  const conCoincidencia = puntuadas.filter((p) => p.puntaje > 0)
  if (conCoincidencia.length >= 2) {
    return conCoincidencia.slice(0, n)
  }
  // fallback: completar hasta n con lo mejor disponible
  return puntuadas.slice(0, Math.max(n, 2))
}
