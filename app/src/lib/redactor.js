// ─────────────────────────────────────────────────────────────────────────
// ✍️ EL REDACTOR — convierte los datos EXTRAÍDOS en párrafos que se leen
// como escritos por una persona (estilo NotebookLM), pero con una regla de
// hierro: cada dato del párrafo viene de un "slot" verificado (extraído del
// documento o de nuestros JSON). Si un slot está vacío, esa frase NO se
// escribe. Plantillas + hechos = redacción sin invención (Regla de Oro #1).
// ─────────────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso || null
  return `${parseInt(m[3], 10)} de ${MESES[parseInt(m[2], 10) - 1]} de ${m[1]}`
}

// Párrafo para una LECTURA (de Sentinel o del robot) — doc trae: empresa,
// categoria, categoriaClave?, veredicto, fecha?, detalles{}, montos[], razones[]
export function redactarLectura(doc) {
  const d = doc.detalles || {}
  const quien = doc.empresa ? `**${doc.empresa}**` : 'la empresa'
  const cuando = doc.fecha ? ` el ${fechaLarga(doc.fecha)}` : ''
  const frases = []

  const clave = doc.categoriaClave || claveDesdeNombre(doc.categoria)

  // los comunicados de matrices extranjeras llegan en inglés — avisarlo
  if (doc.idioma === 'en') {
    frases.push('El comunicado original está en inglés (suele pasar cuando lo emite la matriz del grupo); esto es lo que dice:')
  }

  if (clave === 'derivados') {
    frases.push(`Este documento es la notificación oficial que ${quien} envió al regulador${cuando} para transparentar su posición en instrumentos financieros derivados.`)
    if (d.instrumento) frases.push(`La empresa usa ${d.instrumento} para protegerse de las variaciones de precio en sus ventas futuras — cobertura, no especulación.`)
    if (d.nocional?.length) frases.push(`Al cierre del reporte tiene comprometidas ${d.nocional.join(' y ')} en estos contratos.`)
    if (d.resultadoAcumulado) frases.push(`En lo que va del año, estos contratos le acumulan un resultado de ${d.resultadoAcumulado}.`)
    frases.push('Es un reporte periódico de transparencia: información rutinaria, no una noticia que mueva la acción.')
  } else if (clave === 'dividendo') {
    frases.push(`Este documento comunica una decisión de ${quien} sobre el reparto de utilidades a sus accionistas${cuando}.`)
    if (d.porAccion) frases.push(`El dividendo anunciado es de ${d.porAccion} por acción.`)
    if (d.fechaRegistro) frases.push(`Cobran quienes figuren como accionistas en la fecha de registro: ${d.fechaRegistro}.`)
    if (d.fechaEntrega) frases.push(`El pago está programado para el ${d.fechaEntrega}.`)
    frases.push('Los repartos suelen ser bien recibidos — pero revisa si es un pago regular o extraordinario antes de sacar conclusiones.')
  } else if (clave === 'junta') {
    frases.push(`Este documento convoca (o comunica los acuerdos de) una junta de accionistas de ${quien}${cuando} — el espacio donde los dueños votan las decisiones grandes.`)
  } else if (clave === 'legal') {
    frases.push(`Este documento informa sobre un tema legal o regulatorio que involucra a ${quien}${cuando}.`)
    if (d.montoLegal) frases.push(`El monto en disputa o sanción que se menciona: ${d.montoLegal}.`)
    frases.push('Los temas legales pueden tardar años y no siempre terminan mal, pero merecen seguimiento.')
  } else if (clave === 'operacional') {
    frases.push(`Este documento reporta un evento que afecta las operaciones de ${quien}${cuando}.`)
  } else if (clave === 'adquisicion') {
    frases.push(`Este documento informa sobre un movimiento de propiedad o reorganización que involucra a ${quien}${cuando} — compras, ventas, fusiones o cambios de control.`)
    if (d.partes) frases.push(`Las partes que negocian: ${d.partes}.`)
    if (d.montoOperacion) frases.push(`El monto que se menciona en la operación: ${d.montoOperacion}.`)
    if (d.cambioControl) frases.push('Lo grande aquí: podría cambiar quién CONTROLA la empresa — este tipo de noticia suele mover el precio y merece seguimiento.')
    if (d.enNegociacion) frases.push('Ojo: es una negociación EN CURSO — no hay acuerdo cerrado, ni precio ni fecha definidos, y podría no concretarse.')
  } else if (clave === 'directorio') {
    frases.push(`Este documento comunica cambios en la plana directiva o gerencial de ${quien}${cuando}.`)
    if (d.persona) frases.push(`La persona involucrada: ${d.persona}${d.cargo ? ` (${d.cargo.toLowerCase()})` : ''}.`)
    else if (d.cargo) frases.push(`El cargo involucrado: ${d.cargo.toLowerCase()}.`)
  } else if (clave === 'deuda') {
    frases.push(`Este documento informa sobre deuda o financiamiento de ${quien}${cuando} — emisiones de bonos, préstamos o refinanciaciones.`)
    if (d.montoDeuda) frases.push(`El monto involucrado: ${d.montoDeuda}.`)
    if (d.tasa) frases.push(`La tasa que se menciona: ${d.tasa}.`)
    frases.push('Endeudarse no es malo en sí: lo importante es para qué se usa la plata y si la tasa es sana para la empresa.')
  } else if (clave === 'rating') {
    frases.push(`Este documento acompaña un informe de clasificación de riesgo sobre ${quien}${cuando} — la "nota" que una clasificadora independiente le pone a su capacidad de pagar sus deudas.`)
    frases.push('Es información técnica útil para entender su solidez financiera, no una noticia que por sí sola mueva la acción.')
  } else if (clave === 'auditoria') {
    frases.push(`Este documento informa sobre la auditoría externa de ${quien}${cuando} (por ejemplo, el inicio de los trabajos del auditor independiente que revisará sus estados financieros).`)
    frases.push('Es un trámite normal del calendario contable de toda empresa listada — administrativo, no una noticia.')
  } else if (clave === 'resultados') {
    frases.push(`Este documento acompaña la presentación de información financiera de ${quien}${cuando} al regulador.`)
    if (d.utilidad) frases.push(`La utilidad neta que reporta: ${d.utilidad}.`)
    if (d.ingresos) frases.push(`Los ingresos que menciona: ${d.ingresos}.`)
  } else {
    frases.push(`Este es un comunicado oficial de ${quien}${cuando} al mercado (hecho de importancia).`)
  }

  if (!d.porAccion && !d.resultadoAcumulado && doc.montos?.length) {
    frases.push(`Entre las cifras que menciona: ${doc.montos.slice(0, 3).join(', ')}.`)
  }
  return frases.join(' ')
}

// para las lecturas del robot, que guardan el NOMBRE de la categoría
function claveDesdeNombre(nombre) {
  const n = String(nombre || '').toLowerCase()
  if (n.includes('derivado')) return 'derivados'
  if (n.includes('dividendo') || n.includes('utilidades')) return 'dividendo'
  if (n.includes('junta')) return 'junta'
  if (n.includes('legal')) return 'legal'
  if (n.includes('operacional')) return 'operacional'
  if (n.includes('reorganiz') || n.includes('compra')) return 'adquisicion'
  if (n.includes('directorio') || n.includes('gerencia')) return 'directorio'
  if (n.includes('deuda') || n.includes('financiamiento')) return 'deuda'
  if (n.includes('clasificaci')) return 'rating'
  if (n.includes('auditor')) return 'auditoria'
  if (n.includes('resultados') || n.includes('financiera')) return 'resultados'
  return null
}

// Párrafo introductorio para la CHARLA DE LA GERENCIA (gerencia.json)
export function redactarGerencia(nombreEmpresa, g) {
  const partes = [
    `En su "Análisis y Discusión de la Gerencia" del ${String(g.periodo || '').replace('-T', ', trimestre ')}` +
    `${g.fechaPresentacion ? ` (presentado el ${g.fechaPresentacion})` : ''}, la propia gerencia de **${nombreEmpresa}** cuenta cómo le fue.`,
  ]
  if (g.paginas) partes.push(`Son ${g.paginas} páginas; esto es lo que un lector experto subrayaría:`)
  return partes.join(' ')
}
