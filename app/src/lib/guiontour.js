import { lenteDe, esCiclico, deudaInfo, aniosTexto, PALABRA_DEUDA, umbralesDe } from './lente'
import { peInfo, precioDe, dividendosDe, cambio6M } from './finanzas'
import { combosDe } from './analista'
import { NIVELES } from './nivel'

// ─────────────────────────────────────────────────────────────────────────
// 🚶📖 EL GUION DEL TOUR DE LA FICHA (sesión 2 del plan educativo: #1, #3 y
// #101). Tres cambios de fondo frente al tour viejo:
//   1. POR NIVEL: cada paso declara en qué nivel nace (`n`). El tour normal
//      muestra los pasos de nivel ≤ el del usuario; el tour de DESBLOQUEO
//      (#2) muestra SOLO los del nivel recién estrenado.
//   2. CON EL DATO REAL: los textos se arman con los números de ESA empresa
//      y con su LENTE (lib/lente.js) — no con frases genéricas. Si un dato
//      no está, la frase se cae sola (Regla de Oro #1: nada inventado).
//   3. EN EL ORDEN DE LA ESCALERA (#101), no en el orden del DOM:
//      qué hace → de qué vive → por qué le fue así → riesgos → recién
//      entonces "¿está barata?" → ¿ya puedes decidir tú?
// Los pasos cuyo elemento no exista los salta TourGuia solo, así que aquí se
// pueden declarar todos sin condicionales frágiles.
// ─────────────────────────────────────────────────────────────────────────

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-')
  return `${d}/${m}/${a}`
}

// "S/ 30.31" o null
function precioTexto(ticker) {
  const px = precioDe(ticker)
  if (!px || px.precio == null) return null
  return `${px.moneda} ${px.precio}`
}

// El trozo de frase que cuenta cómo se mueve el precio, si hay serie limpia.
function frasePrecio(ticker) {
  const c = cambio6M(ticker)
  if (c == null) return 'Esta acción se negocia poco: su precio puede quedarse quieto semanas y luego saltar de golpe.'
  const signo = c >= 0 ? 'subió' : 'bajó'
  return `En los últimos 6 meses ${signo} ${Math.abs(c).toFixed(1)}% — pero eso ya pasó: no es lo que va a hacer mañana.`
}

function fraseDividendo(ticker) {
  const dv = dividendosDe(ticker)
  if (!dv || (!dv.anual && !dv.anualNum)) {
    return 'Esta no reparte dividendos hoy: si inviertes aquí, tu única ganancia posible es que el precio suba.'
  }
  const y = dv.yield ? ` (rinde ${dv.yield} al año sobre el precio de hoy)` : ''
  return `Reparte ${dv.anual || 'dividendos'} por acción al año${y}. Ojo: es lo que pagó, no lo que promete pagar.`
}

function fraseDeuda(empresa) {
  const info = deudaInfo(empresa)
  if (!info) return null
  if (info.aplica === false) {
    return `Aquí la lección es al revés: en ${info.lente.nombre.toLowerCase()} la deuda NO SE MIDE ASÍ — ${info.lente.deudaComoSeLee.replace(/^No se lee\.\s*/, '')} Por eso la tarjeta te dice qué mirar en su lugar.`
  }
  if (info.cajaNeta) return 'Tiene más caja que deuda: le sobra dinero después de pagar todo lo que debe.'
  if (info.sinDato || info.sinGanancia) return `Aquí no podemos darte el número: ${info.motivo}. Preferimos decírtelo a inventarlo.`
  const p = PALABRA_DEUDA[info.estado]
  const u = umbralesDe(empresa)
  const base = `Su deuda equivale a ${aniosTexto(info.anios)} de su ganancia — veredicto: ${p ? p.corto.toLowerCase() : 'sin veredicto'}.`
  const umbral = u ? ` Con el lente de ${info.lente.nombre.toLowerCase()}, cómodo es menos de ${u.verde} años.` : ''
  const estres = info.aniosEstres
    ? ` Y como es cíclica, la prueba de fondo: si su ganancia se parte a la mitad, la misma deuda pasa a ${aniosTexto(info.aniosEstres)}.`
    : ''
  return base + umbral + estres
}

function fraseValoracion(empresa) {
  const info = peInfo(empresa.ticker)
  const ciclo = esCiclico(empresa)
    ? ' ⚠ En una empresa cíclica un P/E bajo suele ser una trampa: aparece cuando su ganancia está en el pico y está a punto de caer.'
    : ''
  if (!info) return 'Aquí comparamos su precio con lo que gana. Si falta el dato, lo decimos — no lo estimamos.' + ciclo
  if (info.perdida) return 'No tiene P/E: el año pasado tuvo pérdida, así que no hay ganancia con la cual dividir el precio.' + ciclo
  const ref = info.referencial ? ` ⚠ Su último precio es del ${fechaCorta(info.fechaPrecio)} (negocia poco), así que este P/E es referencial.` : ''
  // Ojo con la moneda: varias cotizan en US$ — la frase no dice "soles".
  return `Su P/E es ${info.pe.toFixed(1)}: por cada acción pagas ${info.pe.toFixed(1)} veces lo que la empresa gana en un año. Aquí abajo está la cuenta completa y contra qué rango la comparamos.${ref}${ciclo}`
}

// El paso que cierra el análisis: los combos que SÍ aplican a esta empresa,
// nombrados con su propio título (nada de "aquí verás cosas interesantes").
function fraseAnalista(empresa) {
  const combos = combosDe(empresa)
  const base = 'Aquí abajo está el paso que separa leer números de entenderlos: los indicadores CRUZADOS. '
    + 'Ninguno significa nada solo — un P/E bajo puede ser ganga o pico de ciclo, y lo que decide cuál es el número de al lado. '
  if (!combos.length) {
    return base + 'En esta empresa hoy no hay ningún cruce con todos sus datos completos, así que no te inventamos ninguno.'
  }
  const cuantos = combos.length === 1 ? 'un cruce' : `${combos.length} cruces`
  return base + `En ${empresa.ticker} se pueden armar ${cuantos}, y el primero es este: «${combos[0].titulo}».`
}

// ── El guion, en el orden de la ESCALERA (no el del DOM) ──────────────────
// n = nivel en el que nace el paso (1 = todos).
export function pasosFicha(empresa, nivel = 4) {
  if (!empresa) return []
  const t = empresa.ticker
  const l = lenteDe(empresa)
  const px = precioTexto(t)
  const siguiente = NIVELES.find((n) => n.id === (nivel || 1) + 1)

  const pasos = [
    {
      n: 1, sel: '.rx',
      icono: '🩻', titulo: 'Primero, el vistazo (10 segundos)',
      texto: `Estos globitos son la foto rápida de ${t}: cómo le fue al precio, si te paga, si está cara o barata, si debe mucho. Es un VISTAZO, no una lección — el resto de la ficha es el porqué de cada uno, y ese porqué es el que te hace decidir bien.`,
    },
    {
      n: 1, sel: '.tesis',
      icono: '📌', titulo: '1️⃣ ¿Qué hace esta empresa?',
      texto: `Antes de opinar del precio hay que saber qué compras. Esta línea dice qué es ${empresa.nombre} y cuál es su gracia. Las palabras con puntitos se tocan y te explican el término.`,
    },
    {
      n: 1, sel: '.vive-de',
      icono: '💰', titulo: '2️⃣ ¿Cómo gana dinero?',
      texto: l
        ? `${empresa.nombre} vive de ${l.viveDe}. Por eso se lee con lente de ${l.nombre.toLowerCase()} ${l.icono}: aquí manda ${l.queManda}. Y el error típico con estas: ${l.errorTipico}. Todo lo que veas abajo se juzga con ese ojo.`
        : 'De qué vive la empresa: eso decide con qué ojo se leen todos sus números.',
    },
    {
      n: 2, sel: '.gerencia-tarjeta',
      icono: '🗣', titulo: '3️⃣ ¿Por qué le fue así este trimestre?',
      texto: 'Estas frases son de la propia gerencia, textuales del documento que presentó a la SMV: ellos explicando su trimestre. Es la versión de la parte interesada — contrástala con los números, pero es la respuesta más directa a "¿por qué ganó (o perdió) más este año?".',
    },
    {
      n: 1, sel: '.precio',
      icono: '💵', titulo: 'El precio de una acción',
      texto: px
        ? `${px} es lo que costó UNA acción de ${t} en el último cierre. Ojo con la trampa más común: que una acción cueste centavos no la hace "barata", ni que cueste cientos la hace "cara" — depende de cuánto gana la empresa por cada acción, y eso lo vemos más abajo.`
        : 'Lo que costó UNA acción en el último cierre de la bolsa. Que cueste poco no la hace barata: eso depende de cuánto gana la empresa por acción.',
    },
    {
      n: 1, sel: '.spark',
      icono: '📉', titulo: 'Su recorrido',
      texto: frasePrecio(t) + ' Pasa el dedo por el dibujo y te dice cuánto costaba cada día.',
    },
    {
      n: 3, sel: '[data-tour="produccion"]',
      icono: '⛏️', titulo: 'Cuánto está produciendo',
      texto: 'En una minera, la producción es el motor de todo lo demás: si saca menos metal, ninguna cuenta de abajo se sostiene. Estos son los kilos y toneladas mes a mes, del boletín oficial del MINEM.',
    },
    {
      n: 1, sel: '#sec-dividendos',
      icono: '💰', titulo: 'Lo que te reparte',
      texto: fraseDividendo(t),
    },
    {
      n: 2, sel: '#sec-deuda',
      icono: '💳', titulo: '4️⃣ ¿Puede pagar lo que debe?',
      texto: fraseDeuda(empresa) || 'Convertimos su deuda en algo que se entiende: cuántos AÑOS de ganancia necesitaría para pagarla, con el umbral de SU sector.',
    },
    {
      n: 3, sel: '#sec-movimiento',
      icono: '🌡', titulo: '¿Cuánto se sacude?',
      texto: 'Cuánto se mueve su precio comparado con las demás de la bolsa, calculado con sus cierres reales. No es bueno ni malo: es carácter. Lo que importa es si TÚ dormirías tranquilo con ese vaivén.',
    },
    {
      n: 3, sel: '[data-tour="riesgos"]',
      icono: '⚠️', titulo: 'Lo que puede salir mal',
      texto: 'Sus riesgos, separados entre Documentado (está en un papel oficial) y Rumor (lo dice el mercado). Si no puedes nombrar el riesgo #1 de una empresa, todavía no la conoces.',
    },
    {
      n: 3, sel: '[data-tour="catalizadores"]',
      icono: '⚡', titulo: 'Lo que viene',
      texto: 'Eventos que podrían mover su precio: resultados, dividendos, permisos, juicios. Sirven para saber QUÉ vigilar el próximo trimestre — no para adivinar el precio.',
    },
    {
      n: 3, sel: '[data-tour="escenarios"]',
      icono: '🔮', titulo: 'Cuatro futuros posibles',
      texto: 'De favorable a alto riesgo. No son predicciones: son las cuatro historias que hay que tener en la cabeza para no sorprenderse con ninguna.',
    },
    {
      n: 2, sel: '[data-tour="tips"]',
      icono: '💡', titulo: 'Qué mirar tú mismo',
      texto: `Pistas concretas para estudiar a ${t}: qué dato buscar, qué comparar, qué preguntar. Son educativas — no dicen "compra".`,
    },
    {
      n: 2, sel: '[data-tour="fundamentos"]',
      icono: '📐', titulo: 'Sus cuatro números duros',
      texto: 'Deuda, flujo de caja libre, ganancia por acción y margen — tal como los presentó a la SMV. Cuando falta uno decimos "Pendiente (SMV)" en vez de rellenarlo.',
    },
    {
      n: 2, sel: '.guia-sector',
      icono: '📖', titulo: 'Cómo se leen esos números AQUÍ',
      texto: l
        ? `El orden de lectura correcto para una ${l.nombre.toLowerCase()}: empieza por "lo que más manda" (aquí, ${l.queManda}) y recién después mira el resto. Cada métrica cierra con su ⚠ error común — el que comete casi todo el mundo.`
        : 'Empieza por "lo que más manda" y sigue con el resto. Cada métrica trae su ⚠ error común.',
    },
    {
      n: 3, sel: '#sec-valoracion',
      icono: '🏷', titulo: '5️⃣ Recién ahora: ¿está barata?',
      texto: fraseValoracion(empresa),
    },
    {
      n: 3, sel: '.bpagraf',
      icono: '📈', titulo: '¿Gana más que antes?',
      texto: 'La ganancia por acción, año por año. El P/E de arriba usa UN año; esta barra te dice si ese año fue normal, un pico o un hueco. Es la vacuna contra creerle a un solo número.',
    },
    {
      n: 1, sel: '.sim-par, .sim-card, .sim',
      icono: '🧮', titulo: 'Juega sin arriesgar',
      texto: 'Pon un monto imaginario y mira qué habría pasado. Es para entrenar el ojo con esta empresa concreta — no es una promesa ni una recomendación.',
    },
    {
      n: 4, sel: '[data-tour="hechos"]',
      icono: '📰', titulo: 'Sus noticias oficiales',
      texto: 'Los Hechos de Importancia que la empresa comunica a la SMV, ya leídos por nuestro robot: 🟢 buena pinta, 🔴 ojo, 🟡 neutra. Aquí es donde se entera el mercado — antes que el noticiero.',
    },
    {
      n: 4, sel: '.sentinel',
      icono: '🛰', titulo: 'Sentinel: tú traes el documento',
      texto: 'Suelta el PDF de un hecho o un informe y te lo lee: de qué va, si pinta bien o mal, y qué frases lo dicen. Funciona dentro de tu navegador, sin subir nada a ningún lado.',
    },
    {
      n: 4, sel: '.docs-oficiales',
      icono: '📚', titulo: 'Los papeles originales',
      texto: 'Los documentos tal cual los presentó a la SMV. Todo lo que dice esta app sale de aquí — y queremos que puedas revisarlo tú mismo. Desconfía de quien no te enseña sus fuentes.',
    },
    {
      n: 4, sel: '.reloj-datos',
      icono: '🕐', titulo: 'Cuándo se actualiza',
      texto: 'A qué hora vuelve a mirar el robot y de cuándo es cada dato. Saber la edad de un dato es parte de saber leerlo.',
    },
    {
      n: 4, sel: '[data-tour="fuentes"]',
      icono: '🔎', titulo: 'De dónde salió todo',
      texto: 'La jerarquía que respetamos: filings SMV → reporte auditado → comunicaciones oficiales → medios verificados. Nunca al revés.',
    },
    {
      n: 3, sel: '[data-tour="analista"]',
      icono: '🧠', titulo: 'Y ahora, todo junto',
      texto: fraseAnalista(empresa),
    },
    {
      n: 1, sel: '[data-tour="listo"]',
      icono: '✅', titulo: '6️⃣ ¿Ya puedes decidir tú?',
      texto: 'El cierre. Esta app nunca te va a decir si comprar — te dice si YA ESTÁS LISTO para decidirlo tú. Marca lo que sí sabes; lo que quede en blanco tiene un enlace a la sección donde está la respuesta.',
    },
    {
      n: 1, sel: '.btn-fav',
      icono: '⭐', titulo: 'Guárdala y te avisamos',
      texto: `Toca la estrellita y ${t} queda en tu lista del inicio, vigilada: si publica una noticia importante, te suena un aviso.`,
    },
    {
      n: 1, sel: '.nivel-cta',
      icono: '🔓', titulo: siguiente ? `¿Quieres más? Sigue "${siguiente.nombre}"` : '¡Y eso es todo!',
      texto: siguiente
        ? `Cuando esto te quede chico, sube aquí y se abren: ${siguiente.incluye.join(' · ')}. Nada se pierde y puedes volver cuando quieras — al subir te presento lo nuevo. 🎉`
        : 'Ya estás en el nivel máximo: ves todo lo que tenemos de esta empresa. 🎉',
    },
  ]

  return pasos.filter((p) => p.n <= (nivel || 1))
}

// 🔓 Tour de DESBLOQUEO (#2): solo lo que acaba de aparecer en pantalla.
// Es el momento de mayor curiosidad del usuario y hasta hoy estaba mudo.
export function pasosDesbloqueo(empresa, nivel) {
  const nuevos = pasosFicha(empresa, nivel).filter((p) => p.n === nivel)
  if (!nuevos.length) return []
  return nuevos
}

// Cuántos de esos pasos existen DE VERDAD en esta ficha (para no ofrecer un
// tour de 0 pasos en una empresa a la que le faltan secciones).
export function cuentaVisibles(pasos) {
  return pasos.filter((p) => {
    const el = document.querySelector(p.sel)
    if (!el) return false
    const r = el.getBoundingClientRect() // mismo criterio que TourGuia
    return r.width > 0 && r.height > 0
  }).length
}
