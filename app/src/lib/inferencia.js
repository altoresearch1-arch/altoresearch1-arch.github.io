import { partirOraciones } from './sentinel'

// ─────────────────────────────────────────────────────────────────────────
// 🧠 EL MOTOR DE INFERENCIAS — el "paso 2" de un RAG (razonar, no solo buscar).
//
// No es un LLM (no hay servidor ni API): es un razonador DETERMINÍSTICO que
// corre EN el navegador sobre la EVIDENCIA que le pasan (fragmentos de los
// documentos del usuario y/o hechos curados de ALTO). Su trabajo:
//   1. clasificar cada pieza de evidencia (a favor / en contra / neutra)
//   2. agrupar por empresa y por tema
//   3. detectar ACUERDOS (varias fuentes coinciden) y CONTRADICCIONES
//   4. componer una respuesta estructurada, tono de ANALISTA, SOLO con esa
//      evidencia y CITANDO cada punto
//   5. si la evidencia no alcanza, DECIRLO (jamás inventa — Regla #1)
//   6. jamás dice qué comprar/vender (Regla #9)
//
// Contrato de una pieza de evidencia:
//   { texto, cita, empresa?, tema?, polaridad?, periodo?, valorNum?, metrica?, fuenteId? }
//   - polaridad/tema son OPCIONALES: si vienen (evidencia curada) se respetan;
//     si no (fragmento libre de un PDF) se INFIEREN aquí.
// ─────────────────────────────────────────────────────────────────────────

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// ── léxicos de señales (ES + EN): el corazón de la clasificación ───────────
const POS = ['record', 'maximo historico', 'crecio', 'crecimiento', 'aumento', 'aumentaron',
  'subio', 'mejoro', 'mejora', 'supero', 'solido', 'solida', 'fuerte', 'expansion', 'ganancia',
  'utilidad', 'superavit', 'alza', 'positivo', 'favorable', 'aprobo dividendo', 'dividendo',
  'acuerdo', 'avance', 'exito', 'rentable', 'eficiencia', 'optimo', 'grew', 'increased', 'rose',
  'higher', 'strong', 'profit', 'gain', 'improved', 'beat', 'robust', 'record high', 'growth', 'surged']
const NEG = ['perdida', 'perdidas', 'cayo', 'caida', 'disminuyo', 'bajo', 'redujo', 'reduccion',
  'retraso', 'demora', 'huelga', 'paralizacion', 'suspension', 'multa', 'sancion', 'demanda',
  'litigio', 'arbitraje', 'deterioro', 'impairment', 'incumplimiento', 'default', 'going concern',
  'negocio en marcha', 'debil', 'contingencia', 'riesgo', 'deficit', 'negativo', 'desfavorable',
  'sobrecosto', 'conflicto', 'downgrade', 'loss', 'losses', 'fell', 'declined', 'decreased',
  'lower', 'weak', 'delay', 'strike', 'penalty', 'lawsuit', 'litigation', 'shortfall', 'writedown']
const NEGADORES = ['no', 'sin', 'nunca', 'ningun', 'ninguna', 'tampoco', 'jamas']

// ── temas: para "agrupar por tema" (cada uno con sus palabras clave) ───────
const TEMAS = [
  ['resultados', /(utilidad|ganancia|perdida|ingreso|venta|ebitda|margen|resultado neto|net income|revenue|profit|earnings|bpa|eps|\bnpi\b|net profit interest|flujo de caja|cash flow)/],
  ['financiamiento', /(deuda|bono|emision|notes|obligacion|prestamo|colocacion|financ|capital adicional|apalancam|debt|leverage|refinanc)/],
  ['dividendos', /(dividendo|reparto de utilidad|dividend|payout)/],
  ['produccion', /(produccion|onzas|toneladas|\bley\b|grade|g\/t|extraccion|production|output|lluvia|estacional|clima|transporte|envio|procesad|proceso de mineral)/],
  ['exploracion', /(perforacion|exploracion|recursos|reservas|drilling|sondaje|yacimiento|resource|reserve)/],
  ['construccion', /(planta|construccion|obra|comisionamiento|puesta en marcha|construction|commissioning)/],
  ['control', /(adquisicion|fusion|\bopa\b|control|compra de acciones|toma de control|merger|acquisition|takeover|stake|boliden|votorantim)/],
  ['riesgos', /(huelga|demanda|litigio|multa|sancion|contingencia|going concern|negocio en marcha|paralizacion|suspension|conflicto|strike|lawsuit|penalty)/],
  ['costos', /(costo|cash cost|aisc|opex|gasto operativo|all-in sustaining|cost)/],
  ['gobernanza', /(parte relacionada|prestamo a la matriz|matriz|directorio|estatuto|gobierno corporativo|related party|governance)/],
]
const TEMA_LEGIBLE = {
  resultados: 'resultados', financiamiento: 'deuda y financiamiento', dividendos: 'dividendos',
  produccion: 'producción', exploracion: 'exploración', construccion: 'construcción / planta',
  control: 'control accionario', riesgos: 'riesgos', costos: 'costos', gobernanza: 'gobernanza',
  general: 'lo general',
}

export function inferirTema(texto) {
  const t = norm(texto)
  for (const [clave, re] of TEMAS) if (re.test(t)) return clave
  return 'general'
}

// cuenta señales +/- en una oración, con manejo simple de negación (neutraliza)
function puntuarPolaridad(texto) {
  const t = ' ' + norm(texto) + ' '
  const palabras = t.split(/[^a-z0-9%\/]+/)
  const negadaCerca = (idx) => {
    for (let k = Math.max(0, idx - 3); k < idx; k++) if (NEGADORES.includes(palabras[k])) return true
    return false
  }
  let pos = 0, neg = 0
  const marca = (lista, suma) => {
    for (const w of lista) {
      let desde = 0
      const idx = t.indexOf(' ' + w + ' ', desde)
      if (idx === -1) continue
      // posición aproximada en palabras para chequear negación
      const antes = t.slice(0, idx).split(/[^a-z0-9%\/]+/).length
      if (negadaCerca(antes)) continue // "no creció", "sin pérdidas" → no suma
      if (suma > 0) pos++; else neg++
    }
  }
  marca(POS, 1)
  marca(NEG, -1)
  // dirección numérica: +N% suma, -N% o (N) resta (cerca de una cifra)
  if (/\+\s?\d/.test(t) || /\bup\b|\bal alza\b/.test(t)) pos++
  if (/-\s?\d+\s?%|\(\s?\d[\d.,]*\s?\)/.test(t)) neg++
  return { pos, neg }
}

export function clasificarPolaridad(texto) {
  const { pos, neg } = puntuarPolaridad(texto)
  if (pos === 0 && neg === 0) return 'neutro'
  if (pos > neg) return 'positivo'
  if (neg > pos) return 'negativo'
  return 'neutro' // empate: no forzar un lado
}

// ── normaliza la evidencia: rellena tema/polaridad si faltan ──────────────
function prepararEvidencia(evidencias) {
  return (evidencias || [])
    .filter((e) => e && e.texto && String(e.texto).trim().length >= 15)
    .map((e, i) => ({
      texto: String(e.texto).trim(),
      cita: e.cita || 'documento',
      empresa: e.empresa || null,
      fuenteId: e.fuenteId || e.cita || `f${i}`,
      periodo: e.periodo || null,
      valorNum: e.valorNum ?? null,
      metrica: e.metrica || null,
      tema: e.tema || inferirTema(e.texto),
      polaridad: e.polaridad || clasificarPolaridad(e.texto),
    }))
}

// la oración más corta y jugosa de un fragmento largo (para citar limpio)
function frasePresentable(texto, max = 240) {
  const oraciones = partirOraciones(String(texto).replace(/\n+/g, ' ')).filter((o) => o.length >= 25)
  const o = oraciones[0] || texto
  return o.length > max ? o.slice(0, max) + '…' : o
}

// ── detectar ACUERDOS y CONTRADICCIONES entre fuentes ─────────────────────
function acuerdosYContradicciones(ev) {
  const acuerdos = []
  const contradicciones = []
  const fuentesDistintas = (lista) => new Set(lista.map((x) => x.fuenteId)).size

  // por tema: ¿coinciden varias fuentes? ¿chocan en dirección?
  const porTema = {}
  for (const e of ev) (porTema[e.tema] ||= []).push(e)
  for (const [tema, lista] of Object.entries(porTema)) {
    const pos = lista.filter((x) => x.polaridad === 'positivo')
    const neg = lista.filter((x) => x.polaridad === 'negativo')
    if (pos.length && neg.length && fuentesDistintas([...pos, ...neg]) >= 2) {
      contradicciones.push({
        tema,
        texto: `Sobre ${TEMA_LEGIBLE[tema] || tema}, tus fuentes NO coinciden: una apunta a lo positivo («${frasePresentable(pos[0].texto, 120)}» — 📎 ${pos[0].cita}) y otra a lo negativo («${frasePresentable(neg[0].texto, 120)}» — 📎 ${neg[0].cita}).`,
      })
    } else if (pos.length >= 2 && fuentesDistintas(pos) >= 2) {
      acuerdos.push(`Varias fuentes coinciden en lo positivo sobre ${TEMA_LEGIBLE[tema] || tema}.`)
    } else if (neg.length >= 2 && fuentesDistintas(neg) >= 2) {
      acuerdos.push(`Varias fuentes coinciden en lo negativo sobre ${TEMA_LEGIBLE[tema] || tema}.`)
    }
  }

  // contradicción DURA: misma métrica + mismo período + cifra distinta
  const conNum = ev.filter((x) => x.metrica && x.valorNum != null && x.periodo)
  for (let i = 0; i < conNum.length; i++) {
    for (let j = i + 1; j < conNum.length; j++) {
      const a = conNum[i], b = conNum[j]
      if (a.metrica !== b.metrica || a.periodo !== b.periodo || a.fuenteId === b.fuenteId) continue
      const delta = Math.abs(b.valorNum - a.valorNum) / Math.max(Math.abs(a.valorNum), 1)
      if (delta > 0.02) {
        contradicciones.push({
          tema: a.tema,
          texto: `⚠ Para el MISMO período, dos fuentes dan cifras distintas de ${a.metrica}: «${frasePresentable(a.texto, 90)}» (📎 ${a.cita}) vs «${frasePresentable(b.texto, 90)}» (📎 ${b.cita}). Verifica cuál es la correcta.`,
        })
      }
    }
  }
  return { acuerdos: [...new Set(acuerdos)], contradicciones }
}

// ── la postura de la PREGUNTA (¿asume que es buena/mala?) ──────────────────
function posturaPregunta(pregunta) {
  const q = norm(pregunta)
  if (/(realmente|tan|de verdad|en serio)?\s*mala|mala noticia|es negativ|tan grave|preocupa/.test(q)) return 'asumeMala'
  if (/(realmente|tan|de verdad)?\s*buena|buena noticia|es positiv|es excelente|es genial/.test(q)) return 'asumeBuena'
  return 'neutra'
}

// ── nivel de confianza HONESTO (heurística declarada) ─────────────────────
function confianza({ fuentes, aFavor, enContra, contradicciones, temas }) {
  let pts = 45
  const motivos = []
  if (fuentes >= 3) { pts += 20; motivos.push(`${fuentes} fuentes`) }
  else if (fuentes === 2) { pts += 12; motivos.push('2 fuentes') }
  else { motivos.push('1 sola fuente') }
  const total = aFavor + enContra
  if (total >= 4) { pts += 15; motivos.push('evidencia amplia') }
  else if (total <= 1) { pts -= 15; motivos.push('evidencia escasa') }
  if (aFavor && enContra) { pts += 8; motivos.push('mira ambos lados') }
  if (contradicciones) { pts -= 18; motivos.push('hay contradicciones') }
  if (temas >= 2) pts += 5
  pts = Math.max(25, Math.min(92, pts))
  return `📏 Confianza: ~${pts}% (${motivos.join(' · ')})`
}

// ── EL COMPOSITOR: arma la respuesta de analista ──────────────────────────
const SIN_EVIDENCIA = 'No tengo evidencia suficiente en tus documentos ni en los datos de ALTO para razonar sobre eso. Cárgame el documento en Sentinel 📚 o pregúntame algo más puntual — no voy a inventar una conclusión.'

export function analizarEvidencia(pregunta, evidenciasCrudas, opciones = {}) {
  const ev = prepararEvidencia(evidenciasCrudas)
  if (ev.length === 0) return { texto: SIN_EVIDENCIA, sinEvidencia: true, chips: opciones.chips }

  const empresas = [...new Set(ev.map((e) => e.empresa).filter(Boolean))]
  const sujeto = opciones.sujeto || (empresas.length === 1 ? empresas[0] : empresas.length > 1 ? 'tus documentos' : 'la evidencia')

  const aFavor = ev.filter((e) => e.polaridad === 'positivo')
  const enContra = ev.filter((e) => e.polaridad === 'negativo')
  const neutros = ev.filter((e) => e.polaridad === 'neutro')
  const { acuerdos, contradicciones } = acuerdosYContradicciones(ev)
  const postura = posturaPregunta(pregunta)
  const temas = [...new Set(ev.map((e) => e.tema))]

  const lineas = []

  // encabezado según la postura de la pregunta (razona CONTRA el supuesto)
  if (postura === 'asumeMala') {
    lineas.push(aFavor.length && enContra.length
      ? `Preguntas si lo de **${sujeto}** es *realmente* malo. Mirando solo la evidencia, hay de los dos lados — no todo apunta ahí:`
      : enContra.length
        ? `Preguntas si es *realmente* malo. La evidencia, en efecto, se inclina a lo negativo — pero veamos qué dice exactamente, sin exagerar:`
        : `Preguntas si es malo, pero la evidencia que tengo NO sostiene ese lado. Lo que hay:`)
  } else if (postura === 'asumeBuena') {
    lineas.push(aFavor.length && enContra.length
      ? `Preguntas si lo de **${sujeto}** es *realmente* bueno. La evidencia tiene claroscuros — no es todo color de rosa:`
      : aFavor.length
        ? `La evidencia respalda ese lado positivo, pero conviene mirarla con calma:`
        : `Preguntas si es bueno, pero la evidencia que tengo no lo respalda. Lo que hay:`)
  } else {
    lineas.push(`Razonando **solo con la evidencia** sobre **${sujeto}** (separo lo positivo de lo negativo, sin decidir por ti):`)
  }

  const N_LADO = opciones.corto ? 2 : 3
  const bullet = (e) => `· «${frasePresentable(e.texto)}» — 📎 ${e.cita}`

  if (aFavor.length) {
    lineas.push('')
    lineas.push('✅ **A favor:**')
    for (const e of aFavor.slice(0, N_LADO)) lineas.push(bullet(e))
  }
  if (enContra.length) {
    lineas.push('')
    lineas.push('⚠️ **En contra:**')
    for (const e of enContra.slice(0, N_LADO)) lineas.push(bullet(e))
  }

  if (acuerdos.length) {
    lineas.push('')
    lineas.push('🤝 **Acuerdos entre fuentes:** ' + acuerdos.slice(0, 2).join(' '))
  }
  if (contradicciones.length) {
    lineas.push('')
    lineas.push('⚔️ **Contradicciones / tensión:**')
    for (const c of contradicciones.slice(0, 2)) lineas.push('· ' + c.texto)
  }

  // lo que la evidencia NO permite concluir (honestidad)
  const faltantes = []
  if (!aFavor.length && enContra.length) faltantes.push('no encontré nada que juegue a favor')
  if (!enContra.length && aFavor.length) faltantes.push('no encontré señales en contra')
  if (ev.length <= 2) faltantes.push('la evidencia es escasa (pocos pasajes)')
  if (faltantes.length) {
    lineas.push('')
    lineas.push('❓ **Lo que la evidencia NO permite concluir:** ' + faltantes.join('; ') + '.')
  }

  // cierre de ANALISTA (mesurado, sin recomendar)
  lineas.push('')
  let cierre
  if (aFavor.length && enContra.length) {
    cierre = `Lectura de analista: la evidencia es de **doble filo** — conviven señales positivas (${TEMA_LEGIBLE[aFavor[0].tema] || aFavor[0].tema}) y negativas (${TEMA_LEGIBLE[enContra[0].tema] || enContra[0].tema}). No sostiene un veredicto tajante${postura === 'asumeMala' ? ': concluir que es “completamente malo” sería exagerar' : postura === 'asumeBuena' ? ': dar por hecho que es “todo bueno” sería optimista de más' : ''}.`
  } else if (enContra.length && !aFavor.length) {
    cierre = `Lectura de analista: con esta evidencia, el saldo se inclina a lo **negativo**${contradicciones.length ? ', aunque hay contradicciones que conviene resolver antes' : ''}. Aun así, es un resaltado — no reemplaza leer el documento completo.`
  } else if (aFavor.length && !enContra.length) {
    cierre = `Lectura de analista: el saldo se inclina a lo **positivo**, pero ojo — no encontré el contrapeso, y ausencia de malas noticias no es lo mismo que que no existan.`
  } else {
    cierre = `Lectura de analista: la evidencia es sobre todo **descriptiva** (ni claramente buena ni mala). Haría falta más para inclinar la balanza.`
  }
  lineas.push(cierre)
  if (neutros.length && !aFavor.length && !enContra.length) {
    lineas.push(`· Contexto: «${frasePresentable(neutros[0].texto)}» — 📎 ${neutros[0].cita}`)
  }

  lineas.push(confianza({
    fuentes: new Set(ev.map((e) => e.fuenteId)).size,
    aFavor: aFavor.length, enContra: enContra.length,
    contradicciones: contradicciones.length, temas: temas.length,
  }))
  lineas.push('_Razoné solo con lo citado arriba; no inventé nada ni te digo si comprar._')

  return {
    texto: lineas.join('\n'),
    ticker: opciones.ticker,
    chips: opciones.chips || ['¿Cómo lo razonaste?', '¿Qué riesgos mencionan?', 'Compara mis documentos'],
    meta: { aFavor: aFavor.length, enContra: enContra.length, contradicciones: contradicciones.length, fuentes: new Set(ev.map((e) => e.fuenteId)).size },
  }
}

// ── ¿esta pregunta pide RAZONAR (no solo buscar un dato)? ──────────────────
export function esPreguntaAnalitica(pregunta) {
  const q = norm(pregunta)
  return /(analiza|analisis|analizalo|evalua|evaluacion|valora|conclusion|concluir|que opinas|que piensas|es (realmente |tan )?(buena|mala|grave|preocupante)|buena o mala|mala o buena|vale la pena|deberia preocupar|que tan (buena|mala|grave|riesgos)|sopesa|balance|pros y contras|a favor y en contra|que dice la evidencia|razona|interpreta|tiene sentido|es solida|es debil)/.test(q)
}
