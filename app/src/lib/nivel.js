import { useEffect, useState } from 'react'

// Nivel de experiencia del usuario: lo elige al entrar (puerta obligatoria,
// ver SelectorNivel.jsx) y filtra qué secciones de la ficha ve (Empresa.jsx).
// Es ACUMULATIVO: nivel 3 ve todo lo de 1+2+3. Guardado en localStorage,
// sin cuentas — mismo patrón que lib/favoritos.js.

const CLAVE = 'alto-nivel'
const EVENTO = 'alto-nivel-cambio'
// 🎨 El color elegido a mano para cada nivel: { "1": "morado", "3": "rosa" }.
// Vive aparte del nivel porque son dos decisiones distintas — qué ves (nivel)
// y de qué color lo ves (tinte) — y perder una no debe borrar la otra.
const CLAVE_TINTE = 'alto-tinte-nivel'
const EVENTO_TINTE = 'alto-tinte-cambio'

// Cada nivel es una EXPERIENCIA, no solo un filtro de secciones:
// - corto/color/elemento: identidad visible (badge, selector, transición,
//   y el POLVO del fondo — FondoVivo se tiñe con este color).
// - incluye: qué desbloquea (chips del selector; niveles 2-4 SUMAN a lo anterior).
// - cargando: pasos honestos de la pantalla de transición (describen lo que
//   de verdad se muestra u oculta al cambiar — nada de teatro vacío).
// 🎮 Paleta ELEMENTAL (pedido de Jair 15-jul, guiño a Destiny 2):
//   1 🧵 Cuerda (Strand) verde esmeralda · 2 🔥 Solar fuego ·
//   3 ❄️ Stasis azul celeste · 4 👑 el ORO de ALTO corona el nivel máximo.
// El dorado de la marca no se negocia: botones/títulos siguen siendo oro.
// 🎨 LA PALETA (pedido de Jair 25-jul). Antes el color era el destino: naciste
// en el nivel 1 y eras verde, punto. Ahora el nivel decide QUÉ ves y el tinte
// decide de qué color — y son siete, no cuatro: a los cuatro elementales se
// suman blanco, morado y rosa, que no representan a ningún nivel y por eso
// mismo son de quien los elija.
// Cada entrada trae su `aurora` (el filtro que gira el oro de fábrica hasta
// ese matiz) porque la atmósfera del fondo debe seguir al color, no al número
// de nivel. Todos son tintes CLAROS a propósito: el texto de los botones
// dorados es negro (#1a1405) y tiene que seguir leyéndose encima.
export const PALETA = [
  { id: 'cuerda', nombre: 'Verde', emoji: '🧵', color: '#35da85', aurora: 'hue-rotate(105deg) saturate(1.15)' },
  { id: 'solar', nombre: 'Naranja', emoji: '🔥', color: '#f2721b', aurora: 'hue-rotate(-18deg) saturate(1.4)' },
  { id: 'stasis', nombre: 'Celeste', emoji: '❄️', color: '#6fb7f0', aurora: 'hue-rotate(162deg) saturate(1.05) brightness(1.05)' },
  { id: 'oro', nombre: 'Oro', emoji: '👑', color: '#d4af37', aurora: 'none' },
  { id: 'blanco', nombre: 'Blanco', emoji: '🤍', color: '#e9edf3', aurora: 'saturate(0.14) brightness(1.22)' },
  { id: 'morado', nombre: 'Morado', emoji: '🔮', color: '#a884ff', aurora: 'hue-rotate(218deg) saturate(1.3)' },
  { id: 'rosa', nombre: 'Rosa', emoji: '🌸', color: '#ff8ac4', aurora: 'hue-rotate(288deg) saturate(1.2) brightness(1.05)' },
]

export const NIVELES = [
  {
    id: 1,
    icono: '💸',
    nombre: '¿Cuánto podría ganar?',
    corto: 'Simple',
    color: '#35da85',
    elemento: '🧵',
    frase: 'Quiero ver cómo se movería mi dinero',
    detalle: 'Precio, cuánto ganarías o perderías, y si reparte dividendos — sin tecnicismos.',
    // Quién es esta persona y qué se le esconde. Se escribe acá (fuente única
    // de los niveles) y lo usan el diploma del plan y el selector.
    paraQuien: 'Para ti si nunca compraste una acción y lo primero que quieres saber es cuánto podrías ganar o perder.',
    sinEsto: 'No verás valoración ni riesgos: se te muestran cuando los pidas.',
    incluye: ['Precio y su gráfico', 'Simulador de ganancia', 'Dividendos', '¿Barata o cara?'],
    cargando: ['Trayendo el precio y los dividendos…', 'Armando tu simulador…', 'Escondiendo los tecnicismos'],
  },
  {
    id: 2,
    icono: '🟡',
    nombre: 'Explícamela fácil',
    corto: 'Aprender',
    color: '#f2721b',
    elemento: '🔥',
    frase: 'Nunca he invertido, quiero entender primero',
    detalle: 'Tips para estudiar la empresa, sus fundamentos y cómo leer sus números.',
    paraQuien: 'Para ti si prefieres entender antes de poner un sol: te explico cada número mientras lo miras.',
    sinEsto: 'Todavía sin catalizadores ni escenarios: eso llega en el 3.',
    incluye: ['Tips para estudiarla', 'Fundamentos (SMV)', 'Cómo leer sus números'],
    cargando: ['Sumando tips y fundamentos…', 'Activando las explicaciones al toque…', 'Preparando el modo aprender'],
  },
  {
    id: 3,
    icono: '📊',
    nombre: 'Quiero analizarla',
    corto: 'Análisis',
    color: '#6fb7f0',
    elemento: '❄️',
    frase: 'Ya sé lo básico, quiero explorar y comparar',
    detalle: 'Catalizadores, escenarios, riesgos y producción minera (si aplica).',
    paraQuien: 'Para ti si ya sabes qué es una acción y ahora quieres decidir con criterio: comparar dos empresas y ver qué puede salir mal.',
    sinEsto: 'Sin los documentos crudos de la SMV ni el radar Sentinel: eso es el 4.',
    incluye: ['Catalizadores', 'Escenarios y riesgos', 'Producción minera', 'BPA año por año', '🧠 Lectura de analista'],
    cargando: ['Cargando catalizadores y escenarios…', 'Midiendo los riesgos…', 'Subiendo la densidad de datos'],
  },
  {
    id: 4,
    icono: '🧠',
    nombre: 'Lobo de wall street',
    corto: 'Lobo',
    color: '#d4af37',
    elemento: '👑',
    frase: 'Dame acceso completo, con IA y documentos oficiales',
    detalle: 'Sentinel, hechos de importancia, documentos SMV, noticias y todo lo demás.',
    paraQuien: 'Para ti si lees memorias y hechos de importancia, y quieres la fuente cruda además del resumen.',
    sinEsto: 'Nada oculto: es la app entera, con todo encendido.',
    incluye: ['Sentinel 🛰️', 'Hechos de importancia', 'Documentos SMV', 'Fuentes y reloj de datos'],
    cargando: ['Desplegando Sentinel y los hechos…', 'Abriendo los documentos SMV…', 'Acceso completo concedido'],
  },
]

// Qué secciones de la ficha requieren qué nivel mínimo. Lo que no aparece
// aquí es nivel 1 (base: siempre visible — precio, tesis, simulador).
// valoracion/termometro (el "porqué" con fórmula y medidor) son nivel 3:
// en los niveles 1-2 la radiografía muestra SOLO el veredicto y eso pica la
// curiosidad para subir de nivel (pedido de Jair 15-jul: que atrape, no que
// dé toda la comodidad de entrada).
export const NIVEL_SECCION = {
  tips: 2,
  guiaSector: 2,
  fundamentos: 2,
  // 💳 "¿Puede pagar su deuda?" y 🗣 "¿por qué le fue así este trimestre?"
  // entran en el nivel 2: son los escalones 2 y 3 de la escalera de
  // aprendizaje (qué hace → cómo gana → por qué este año), y llegan ANTES
  // que el veredicto de precio, que vive en el 3. El VEREDICTO de deuda, en
  // cambio, lo ven todos: está en la radiografía de 10 segundos.
  deuda: 2,
  gerencia: 2,
  // 🥇 El precio del metal / petróleo / harina que mueve a la empresa (#116).
  // Nivel 2 porque es el "cómo gana dinero" llevado hasta el final: sin este
  // precio, la mitad de la BVL no se entiende.
  precioMotor: 2,
  valoracion: 3,
  bpaHistorico: 3,
  termometro: 3,
  produccionMinera: 3,
  balanceDestacado: 3,
  catalizadores: 3,
  escenarios: 3,
  riesgos: 3,
  // 🧠 Los combos del analista (#43): cruzar indicadores es el oficio del
  // nivel 3 ("quiero analizarla"). No sube al 4 porque no necesita ningún
  // dato exclusivo del 4 — necesita que el usuario ya haya visto los
  // números sueltos, y eso pasa recién aquí.
  lecturaAnalista: 3,
  relojDatos: 4,
  hechos: 4,
  noticiasExtranjero: 4,
  sentinel: 4,
  documentosOficiales: 4,
  fuentes: 4,
}

export function verSeccion(nivel, clave) {
  return nivel >= (NIVEL_SECCION[clave] || 1)
}

// ── 🎨 TINTE POR NIVEL ─────────────────────────────────────────────────────
// El tinte de fábrica de cada nivel es el elemental que ya tenía (su `color`);
// lo que el usuario elija a mano lo pisa, y solo para ESE nivel.
function tinteDeFabrica(n) {
  return PALETA.find((p) => p.color === n?.color) || PALETA[3] /* oro */
}

function leerMapaTintes() {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_TINTE) || '{}')
    return crudo && typeof crudo === 'object' ? crudo : {}
  } catch {
    return {}
  }
}

// Tinte efectivo de un nivel: el elegido a mano, o el de fábrica.
export function tinteNivel(nivelId) {
  const n = NIVELES.find((x) => x.id === nivelId)
  if (!n) return PALETA[3]
  const elegido = PALETA.find((p) => p.id === leerMapaTintes()[String(nivelId)])
  return elegido || tinteDeFabrica(n)
}

// Color efectivo (hex) de un nivel. Úsalo en vez de `NIVELES[].color` en todo
// lo que se pinte: ese campo es solo el valor de fábrica.
export function colorNivel(nivelId) {
  return tinteNivel(nivelId).color
}

export function esTinteDeFabrica(nivelId) {
  const n = NIVELES.find((x) => x.id === nivelId)
  return tinteNivel(nivelId).id === tinteDeFabrica(n).id
}

// Guarda (o borra, con tinteId = null) el color de UN nivel y repinta al toque:
// el tinte no cambia qué secciones ves, así que no pasa por la pantalla de
// transición — se ve el cambio en el mismo gesto de elegirlo.
export function guardarTinte(nivelId, tinteId) {
  const mapa = leerMapaTintes()
  if (tinteId) mapa[String(nivelId)] = tinteId
  else delete mapa[String(nivelId)]
  try {
    localStorage.setItem(CLAVE_TINTE, JSON.stringify(mapa))
  } catch {
    /* modo incógnito: el color vale solo para esta sesión */
  }
  aplicarTemaNivel(nivelId)
  window.dispatchEvent(new CustomEvent(EVENTO_TINTE))
}

// Hook: el tinte vigente del nivel dado, re-leído cuando alguien lo cambia.
export function useTinte(nivelId) {
  const [tinte, setTinte] = useState(() => tinteNivel(nivelId))
  useEffect(() => {
    const al = () => setTinte(tinteNivel(nivelId))
    al()
    window.addEventListener(EVENTO_TINTE, al)
    window.addEventListener('storage', al) // otra pestaña
    return () => {
      window.removeEventListener(EVENTO_TINTE, al)
      window.removeEventListener('storage', al)
    }
  }, [nivelId])
  return tinte
}

// Tema visual del nivel: marca <html data-nivel="N" data-tinte="X"> y expone el
// color elegido como --nivel-color. Con eso el CSS ajusta densidad, radio de
// bordes y velocidad de animaciones por nivel (ver "EXPERIENCIAS POR NIVEL" en
// styles.css). Sin nivel elegido (puerta de entrada) no hay atributo.
// 👑 Además redefine --oro/--oro-suave/--oro-tenue EN LÍNEA: el bloque "EL
// ELEMENTO REINA" del CSS los fija por [data-nivel], y un estilo inline es lo
// único que gana a esa regla sin usar !important. Así un tinte a mano tiñe de
// un golpe TODO lo que ya era dorado, igual que hacían los cuatro elementales.
export function aplicarTemaNivel(nivel) {
  const raiz = document.documentElement
  const n = NIVELES.find((x) => x.id === nivel)
  if (!n) {
    delete raiz.dataset.nivel
    delete raiz.dataset.tinte
    for (const v of ['--nivel-color', '--oro', '--oro-suave', '--oro-tenue', '--aurora-filtro']) {
      raiz.style.removeProperty(v)
    }
    return
  }
  const t = tinteNivel(n.id)
  raiz.dataset.nivel = String(n.id)
  raiz.dataset.tinte = t.id
  raiz.style.setProperty('--nivel-color', t.color)
  raiz.style.setProperty('--oro', t.color)
  raiz.style.setProperty('--oro-suave', `color-mix(in srgb, ${t.color} 66%, #fff)`)
  raiz.style.setProperty('--oro-tenue', `color-mix(in srgb, ${t.color} 12%, transparent)`)
  raiz.style.setProperty('--aurora-filtro', t.aurora)
}

export function leerNivel() {
  try {
    const n = parseInt(localStorage.getItem(CLAVE), 10)
    return NIVELES.some((x) => x.id === n) ? n : null
  } catch {
    return null
  }
}

export function guardarNivel(id) {
  try {
    localStorage.setItem(CLAVE, String(id))
  } catch {
    /* modo incógnito sin storage: el nivel funciona solo en la sesión */
  }
  window.dispatchEvent(new CustomEvent(EVENTO))
}

// Hook: [nivel actual (null = todavía no eligió), función para cambiarlo]
export function useNivel() {
  const [nivel, setNivelState] = useState(leerNivel)
  useEffect(() => {
    const al = () => setNivelState(leerNivel())
    window.addEventListener(EVENTO, al)
    window.addEventListener('storage', al) // otra pestaña
    return () => {
      window.removeEventListener(EVENTO, al)
      window.removeEventListener('storage', al)
    }
  }, [])
  return [nivel, guardarNivel]
}
