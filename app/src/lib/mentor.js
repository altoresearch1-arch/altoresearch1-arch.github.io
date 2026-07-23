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
//    leído sería mentirle al usuario sobre sí mismo. Desde el 23-jul el ✔✔
//    SÍ existe, y se gana del único modo honesto: contestando la mini-pregunta
//    de la tarjeta (#14). Leer sigue valiendo ✔ y nada más.
//  · #151-5 — la profundidad la decide el NIVEL: la misma tarjeta de P/E da
//    la bodega en nivel 1 y la trampa cíclica en nivel 4.
// ─────────────────────────────────────────────────────────────────────────

// LAS 5 PROFUNDIDADES de §6 dentro de los 4 niveles de la app, sin inventar
// un nivel 5 que el usuario no puede elegir: el cuerpo sube por `niveles`
// (qué es → cómo se interpreta → cómo se decide) y los dos escalones finales
// se AGREGAN al mismo cuerpo en vez de reemplazarlo — así el nivel 4 lee la
// tarjeta entera (decidir + cuándo miente + cómo se combina) y no pierde lo
// de abajo, que es justamente lo que pasaba cuando `niveles.4` pisaba al 3.
const NIVEL_TRAMPA = 3 // ⚠️ "cuándo el número miente"
const NIVEL_COMBO = 4 // 🔗 "cómo lo cruza un analista"

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
    // Los dos escalones de arriba, cada uno a su altura (§6-4 y §6-5).
    trampa: nivel >= NIVEL_TRAMPA ? t.trampa ?? null : null,
    combo: nivel >= NIVEL_COMBO ? t.combo ?? null : null,
    ejemplo: t.ejemplo ?? null,
    pregunta: t.pregunta ?? null,
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
  identidad: {
    etiqueta: '💰 ¿De qué vive esta empresa?',
    dudas: [
      { q: '¿Qué significa «vive de»?', clave: 'viveDe' },
      { q: '¿Qué es una acción, en simple?', clave: 'accion' },
    ],
  },
  gerencia: {
    etiqueta: '🗣 ¿Por qué le fue así?',
    dudas: [
      { q: '¿Quién dice esto?', clave: 'gerencia' },
      { q: '¿Y esto se va a repetir el próximo año?', clave: 'gerencia' },
    ],
  },
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
  hechos: {
    etiqueta: '📰 ¿Qué son estas noticias?',
    dudas: [
      { q: '¿Quién publica esto?', clave: 'hechos' },
      { q: '¿Qué significan los colores 🟢🔴🟡?', clave: 'hechos' },
    ],
  },
  catalizadores: {
    etiqueta: '🎯 ¿Qué se espera que pase?',
    dudas: [
      { q: '¿Esto es una predicción?', clave: 'catalizadores' },
      { q: '¿Y qué puede salir mal?', clave: 'riesgos' },
    ],
  },
  simulador: {
    etiqueta: '🧮 ¿Esto predice mi ganancia?',
    dudas: [
      { q: '¿Este número es una promesa?', clave: 'simulador' },
      { q: '¿Y si baja en vez de subir?', clave: 'simulador' },
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

// ─────────────────────────────────────────────────────────────────────────
// 📖 EL PUENTE CON GLOSADO (§31-3)
// El "mantener presionado cualquier palabra" NO se construye aparte: Glosado
// ya intercepta los términos técnicos. Lo que se agrega es que su tooltip
// pueda saltar a la tarjeta del Mentor que explica ESE término de verdad —
// con analogía, ejemplo y la pregunta siguiente— en vez de morir en la
// definición de diccionario.
// ─────────────────────────────────────────────────────────────────────────
const POR_TERMINO = {}
for (const [clave, t] of Object.entries(TARJETAS)) {
  for (const palabra of t.terminos ?? []) POR_TERMINO[palabra.toLowerCase()] = clave
}

/** La tarjeta que explica esta palabra del glosario, si alguna la reclama. */
export function claveDeTermino(palabra) {
  return POR_TERMINO[String(palabra || '').toLowerCase().trim()] ?? null
}

// Glosado y el Mentor viven en ramas lejanas del árbol: se hablan por un
// evento del documento y no por un contexto nuevo (más barato, y el Mentor
// puede no estar montado — en ese caso simplemente no pasa nada).
export const EVENTO_MENTOR = 'alto-mentor-abrir'

export function pedirTarjeta(clave, { ejemplo = false } = {}) {
  if (!TARJETAS[clave]) return false
  window.dispatchEvent(new CustomEvent(EVENTO_MENTOR, { detail: { clave, ejemplo } }))
  return true
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
// ✔ / ✔✔ EL PROGRESO (localStorage, mismo patrón que favoritos)
// Dos listas separadas a propósito, y no un solo campo con estado: leer y
// saber son cosas distintas y el usuario tiene derecho a ver la diferencia.
//   ✔  visto     → cerró la tarjeta con "entendido". Lo pone él.
//   ✔✔ dominado  → contestó bien la mini-pregunta (#14). Lo prueba él.
// Dominar implica haber visto; visto NUNCA implica dominar (#151-4).
// ─────────────────────────────────────────────────────────────────────────
export const CLAVE_PROGRESO = 'alto-mentor-visto'
export const CLAVE_DOMINADO = 'alto-mentor-dominado'

function leerLista(clave) {
  try {
    const v = JSON.parse(localStorage.getItem(clave) || '[]')
    return Array.isArray(v) ? v.filter((k) => TARJETAS[k]) : []
  } catch {
    return []
  }
}

function sumarA(clave, valor) {
  const v = leerLista(clave)
  if (v.includes(valor)) return v
  const nuevo = [...v, valor]
  try { localStorage.setItem(clave, JSON.stringify(nuevo)) } catch { /* incógnito */ }
  return nuevo
}

export function vistos() {
  return leerLista(CLAVE_PROGRESO)
}

export function marcarVisto(clave) {
  if (!TARJETAS[clave]) return vistos()
  return sumarA(CLAVE_PROGRESO, clave)
}

export function dominados() {
  return leerLista(CLAVE_DOMINADO)
}

/** Solo lo llama la respuesta CORRECTA de la mini-pregunta. */
export function marcarDominado(clave) {
  if (!TARJETAS[clave]) return dominados()
  marcarVisto(clave) // si la contestó, es que la leyó
  return sumarA(CLAVE_DOMINADO, clave)
}

/** Cuántas tarjetas puede aprender alguien de este nivel (el techo honesto). */
export function alcanzables(nivel) {
  return CLAVES.filter((k) => hayTarjeta(k, nivel))
}

/** De esas, cuántas se pueden llegar a DOMINAR (las que tienen pregunta). */
export function examinables(nivel) {
  return alcanzables(nivel).filter((k) => TARJETAS[k].pregunta)
}
