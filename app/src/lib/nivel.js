import { useEffect, useState } from 'react'

// Nivel de experiencia del usuario: lo elige al entrar (puerta obligatoria,
// ver SelectorNivel.jsx) y filtra qué secciones de la ficha ve (Empresa.jsx).
// Es ACUMULATIVO: nivel 3 ve todo lo de 1+2+3. Guardado en localStorage,
// sin cuentas — mismo patrón que lib/favoritos.js.

const CLAVE = 'alto-nivel'
const EVENTO = 'alto-nivel-cambio'

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
    incluye: ['Catalizadores', 'Escenarios y riesgos', 'Producción minera', 'BPA año por año'],
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
  valoracion: 3,
  bpaHistorico: 3,
  termometro: 3,
  produccionMinera: 3,
  balanceDestacado: 3,
  catalizadores: 3,
  escenarios: 3,
  riesgos: 3,
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

// Tema visual del nivel: marca <html data-nivel="N"> y expone su color de
// acento como --nivel-color. Con eso el CSS ajusta densidad, radio de bordes
// y velocidad de animaciones por nivel (ver "EXPERIENCIAS POR NIVEL" en
// styles.css). Sin nivel elegido (puerta de entrada) no hay atributo.
export function aplicarTemaNivel(nivel) {
  const raiz = document.documentElement
  const n = NIVELES.find((x) => x.id === nivel)
  if (!n) {
    delete raiz.dataset.nivel
    raiz.style.removeProperty('--nivel-color')
    return
  }
  raiz.dataset.nivel = String(n.id)
  raiz.style.setProperty('--nivel-color', n.color)
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
