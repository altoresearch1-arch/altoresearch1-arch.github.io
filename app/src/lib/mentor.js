import mentorData from '../data/mentor.json'
import { claveLente } from './lente'

// ─────────────────────────────────────────────────────────────────────────
// 🎓 EL MENTOR ALTO — el motor (mejora #151, idea de Jair)
// La cáscara: resolver QUÉ tarjeta toca según lo que el usuario tocó, en qué
// nivel está y con qué lente se lee esa empresa; qué dudas ofrecer según la
// sección que está mirando; y llevar el progreso honesto.
//
// Reglas de la casa que se respetan aquí:
//  · Regla #1 — si no hay texto para esa clave, NO se inventa: no se abre la
//    tarjeta. Un "no tenemos nada que explicarte" es mejor que un relleno.
//  · #151-4 — el ✔ es "visto", nunca "dominado". Marcar dominado por haber
//    leído sería mentirle al usuario sobre sí mismo. El ✔✔ llega el día que
//    exista la mini-pregunta (#14), y no antes.
//  · #151-5 — la profundidad la decide el NIVEL: la misma tarjeta de P/E da
//    la bodega en nivel 1 y la trampa cíclica en nivel 4.
// ─────────────────────────────────────────────────────────────────────────

const TARJETAS = mentorData.tarjetas ?? {}
export const CLAVES = Object.keys(TARJETAS)
export const TOTAL_TARJETAS = CLAVES.length

/**
 * La tarjeta lista para pintar, o null si esa clave no tiene nada que decir
 * en este nivel (Regla #1: no se abre un panel vacío).
 */
export function tarjetaMentor(clave, { nivel = 2, empresa = null } = {}) {
  const t = TARJETAS[clave]
  if (!t) return null

  // El texto del nivel MÁS ALTO que no pase el del usuario: así una tarjeta
  // escrita solo para el nivel 1 le sirve igual al nivel 4, y una escrita
  // solo para el 3 no aparece a destiempo en el 1.
  const escalones = Object.keys(t.niveles ?? {})
    .map(Number)
    .filter((n) => n <= nivel)
    .sort((a, b) => a - b)
  const cuerpo = escalones.length ? t.niveles[String(escalones[escalones.length - 1])] : null
  if (!cuerpo) return null

  // La línea del lente es un EXTRA: solo si este negocio tiene una advertencia
  // propia escrita a mano. Sin lente que calce, la tarjeta va sin esa línea.
  const lente = empresa ? claveLente(empresa) : null
  const notaLente = lente ? t.lentes?.[lente] ?? null : null

  return {
    clave,
    icono: t.icono,
    titulo: t.titulo,
    seccion: t.seccion,
    cuerpo,
    notaLente,
    ejemplo: t.ejemplo ?? null,
    siguiente: t.siguiente && TARJETAS[t.siguiente.clave] ? t.siguiente : null,
  }
}

/** ¿Hay algo escrito para esta clave en este nivel? (para no encender bordes muertos) */
export function hayTarjeta(clave, nivel) {
  return !!tarjetaMentor(clave, { nivel })
}

// ─────────────────────────────────────────────────────────────────────────
// 🤔 "NO ENTENDÍ" CONTEXTUAL (absorbe la FAQ de preguntas invisibles, #140)
// Las familias del Mapa de Dudas (Parte IV §25): cada sección de la ficha
// tiene SUS dudas típicas, y cada duda abre la tarjeta que la responde.
// La etiqueta es también la que toma el botón flotante al entrar a la
// sección (#151-6), con moderación: cambia por sección, no por scroll.
// ─────────────────────────────────────────────────────────────────────────
export const SECCIONES = {
  motor: {
    etiqueta: '🥇 ¿Qué es «su motor»?',
    dudas: [
      { q: '¿Por qué manda el precio de afuera?', clave: 'motor' },
      { q: '¿Eso mueve la acción igual de rápido?', clave: 'motor' },
    ],
  },
  precio: {
    etiqueta: '📈 ¿Cómo se lee este gráfico?',
    dudas: [
      { q: '¿Qué me dice esta línea?', clave: 'spark' },
      { q: '¿Que se mueva mucho es malo?', clave: 'volatilidad' },
    ],
  },
  dividendos: {
    etiqueta: '💰 ¿Cómo funcionan los dividendos?',
    dudas: [
      { q: '¿Qué es un dividendo?', clave: 'dividendo' },
      { q: '¿Ese % es como el del banco?', clave: 'dividendo' },
      { q: '¿De dónde sale la plata que reparte?', clave: 'fcf' },
    ],
  },
  valoracion: {
    etiqueta: '💎 ¿Por qué dice eso de «barata»?',
    dudas: [
      { q: '¿Qué es el P/E?', clave: 'pe' },
      { q: '¿Quién decidió que está barata?', clave: 'pe' },
      { q: '¿De qué ganancia sale ese número?', clave: 'bpa' },
    ],
  },
  deuda: {
    etiqueta: '🏦 ¿Su deuda es peligrosa?',
    dudas: [
      { q: '¿Cuánta deuda es «mucha»?', clave: 'deuda' },
      { q: '¿Con qué la va a pagar?', clave: 'fcf' },
    ],
  },
  fundamentos: {
    etiqueta: '📐 ¿Qué son estos números?',
    dudas: [
      { q: '¿Qué es el flujo de caja libre?', clave: 'fcf' },
      { q: '¿Qué margen es bueno?', clave: 'margen' },
    ],
  },
  produccion: {
    etiqueta: '⛏️ ¿Qué me dice su producción?',
    dudas: [
      { q: '¿Para qué sirve saber cuánto produce?', clave: 'produccion' },
      { q: '¿Y a qué precio vende eso?', clave: 'motor' },
    ],
  },
  riesgos: {
    etiqueta: '⚠️ ¿Qué puede salir mal?',
    dudas: [
      { q: '¿Estos escenarios son predicciones?', clave: 'riesgos' },
      { q: '¿Ya sé lo suficiente para decidir?', clave: 'decidir' },
    ],
  },
}

export const ETIQUETA_REPOSO = '💡 Explícamelo'

/** Las dudas de la sección que el usuario está mirando (o las generales). */
export function dudasDe(seccion, nivel) {
  const s = SECCIONES[seccion]
  const lista = s
    ? s.dudas
    : [
        { q: '¿Qué es una acción?', clave: 'accion' },
        { q: '¿Qué es un dividendo?', clave: 'dividendo' },
        { q: '¿Qué es el P/E?', clave: 'pe' },
      ]
  // No se ofrece una duda cuya respuesta todavía no existe para este nivel.
  return lista.filter((d) => !d.clave || hayTarjeta(d.clave, nivel))
}

// ─────────────────────────────────────────────────────────────────────────
// ✔ EL PROGRESO (localStorage, mismo patrón que favoritos)
// "Visto", no "dominado" — ver #151-4 arriba.
// ─────────────────────────────────────────────────────────────────────────
export const CLAVE_PROGRESO = 'alto-mentor-visto'

export function vistos() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_PROGRESO) || '[]')
    return Array.isArray(v) ? v.filter((k) => TARJETAS[k]) : []
  } catch {
    return []
  }
}

export function marcarVisto(clave) {
  if (!TARJETAS[clave]) return vistos()
  const v = vistos()
  if (v.includes(clave)) return v
  const nuevo = [...v, clave]
  try { localStorage.setItem(CLAVE_PROGRESO, JSON.stringify(nuevo)) } catch { /* incógnito */ }
  return nuevo
}

/** Cuántas tarjetas puede aprender alguien de este nivel (el techo honesto). */
export function alcanzables(nivel) {
  return CLAVES.filter((k) => hayTarjeta(k, nivel))
}
